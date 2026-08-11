"use server";

/**
 * Server Actions for the 5-pillar partner intake.
 *
 * Split from `actions/partner.ts` because these all share one concern —
 * writing registry-driven pillar data — and because the legacy profile action
 * keeps working untouched during the transition.
 *
 * Every write recomputes `profileStrength` from the *stored* state rather than
 * trusting a client-supplied number, so the score can never be gamed.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { invalidInput } from "@/lib/schemas/errors";
import { exec, insertRow, queryOne, updateRows } from "@/lib/db";
import type { PartnerProfileRow } from "@/lib/db/rows";
import {
  PILLAR_FIELDS,
  fieldsForPillar,
  isTagFacet,
  type PillarKey,
  type TagFacet,
} from "@/lib/partner-pillars";
import { PillarStepSchema, PillarValuesSchema } from "@/lib/partner-pillar-schema";
import {
  pillarValuesToColumns,
  readPillarValues,
} from "@/lib/partner-pillar-values";
import { computeProfileStrength } from "@/lib/partner-strength";
import {
  partnerTagIdsByFacet,
  setPartnerTags,
  suggestTag,
  tagsByIds,
} from "@/lib/tags";

/**
 * Recompute and persist `profileStrength` for a company.
 *
 * Always reads back from the database. The alternative — scoring whatever the
 * client just sent — would let a partner post a single field and claim 100%.
 */
async function refreshProfileStrength(companyId: string): Promise<number> {
  const [profile, tagIds] = await Promise.all([
    queryOne<PartnerProfileRow>(
      'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
      [companyId],
    ),
    partnerTagIdsByFacet(companyId),
  ]);
  const { score } = computeProfileStrength(readPillarValues(profile, tagIds));

  if (profile) {
    await updateRows(
      "PartnerProfile",
      { companyId },
      { profileStrength: score },
    );
  }
  return score;
}

/** Ensure a profile row exists so later column updates have a target. */
async function ensureProfileRow(companyId: string): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    'SELECT "id" FROM "PartnerProfile" WHERE "companyId" = $1',
    [companyId],
  );
  if (existing) return;
  await insertRow(
    "PartnerProfile",
    { companyId },
    { onConflict: '("companyId") DO NOTHING' },
  );
}

function partnerCompanyId(ctx: { user?: { companyId?: string | null } | null }) {
  if (!ctx.user?.companyId) {
    fail({ code: "FORBIDDEN", reason: "Partner company required" });
  }
  return ctx.user!.companyId!;
}

// ─── Suggest a tag ───────────────────────────────────────────────

export const suggestPartnerTagAction = defineAction({
  name: "partner.tag.suggest",
  input: z.object({
    facet: z.string().min(1),
    label: z.string().trim().min(2).max(80),
  }),
  permission: "partner.profile.update",
  // Deliberately tight. Suggestion is the one partner-writable path into the
  // shared vocabulary, so it is the one worth throttling hardest.
  rateLimit: { scope: "partner.tag.suggest", limit: 20, windowSec: 300 },
  handler: async ({ facet, label }, ctx) => {
    partnerCompanyId(ctx);
    if (!isTagFacet(facet)) {
      fail(invalidInput("That tag category isn't recognised.", "facet"));
    }

    // The pillar that owns this facet, so the tag inherits the right grouping.
    const owning = Object.values(PILLAR_FIELDS).find((f) => f.facet === facet);
    const tag = await suggestTag({
      facet: facet as TagFacet,
      pillar: owning?.pillar ?? "positioning",
      label,
    });

    return { ok: true as const, tag: { id: tag.id, label: tag.label } };
  },
});

// ─── Save one pillar ─────────────────────────────────────────────

export const savePillarStepAction = defineAction({
  name: "partner.pillar.save",
  input: PillarStepSchema,
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.pillar.save", limit: 60, windowSec: 60 },
  handler: async ({ pillar, values }, ctx) => {
    const companyId = partnerCompanyId(ctx);
    await ensureProfileRow(companyId);

    // Only accept keys that belong to the declared pillar. Without this a
    // client could post a `commercials` payload under a `positioning` step and
    // bypass the per-facet tag scoping below.
    const allowed = new Set(fieldsForPillar(pillar).map((f) => f.key));
    const scoped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (allowed.has(key)) scoped[key] = value;
    }

    await writePillarValues(companyId, scoped, pillar);

    const strength = await refreshProfileStrength(companyId);
    await updateRows(
      "PartnerProfile",
      { companyId },
      { onboardingStep: pillar },
    );

    revalidatePath("/partner/profile");
    revalidatePath("/partner/onboarding");
    revalidatePath("/partner");
    return { ok: true as const, strength };
  },
});

// ─── Save the whole profile ──────────────────────────────────────

export const savePillarProfileAction = defineAction({
  name: "partner.pillar.saveAll",
  input: z.object({ values: PillarValuesSchema }),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.pillar.saveAll", limit: 30, windowSec: 60 },
  handler: async ({ values }, ctx) => {
    const companyId = partnerCompanyId(ctx);
    await ensureProfileRow(companyId);

    await writePillarValues(companyId, values as Record<string, unknown>, null);

    const strength = await refreshProfileStrength(companyId);
    revalidatePath("/partner/profile");
    revalidatePath("/partner");
    return { ok: true as const, strength };
  },
});

/**
 * Write scalar columns and reconcile tags.
 *
 * `pillarScope` limits tag reconciliation to the facets owned by one pillar.
 * That matters because `setPartnerTags` replaces a facet wholesale: reconciling
 * an absent facet would delete tags the partner never saw on this screen.
 */
async function writePillarValues(
  companyId: string,
  values: Record<string, unknown>,
  pillarScope: PillarKey | null,
): Promise<void> {
  const columns = pillarValuesToColumns(values);
  if (Object.keys(columns).length > 0) {
    await updateRows("PartnerProfile", { companyId }, columns);
  }

  const tagFieldsToWrite = Object.values(PILLAR_FIELDS).filter(
    (f) =>
      f.control === "tags" &&
      f.facet &&
      (pillarScope === null || f.pillar === pillarScope) &&
      Object.hasOwn(values, f.key),
  );

  for (const field of tagFieldsToWrite) {
    const raw = values[field.key];
    const requested = Array.isArray(raw) ? (raw as string[]) : [];

    // Drop ids that don't exist or sit in a different facet. A stale id from a
    // rejected tag would otherwise fail the FK and abort the whole save.
    const resolved = await tagsByIds(requested);
    const valid = resolved
      .filter((t) => t.facet === field.facet)
      .map((t) => t.id);

    await setPartnerTags({
      companyId,
      facet: field.facet as TagFacet,
      tagIds: field.maxSelections
        ? valid.slice(0, field.maxSelections)
        : valid,
    });
  }
}

// ─── Complete onboarding ─────────────────────────────────────────

export const completeOnboardingAction = defineAction({
  name: "partner.onboarding.complete",
  input: z.object({}).default({}),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.onboarding.complete", limit: 10, windowSec: 60 },
  handler: async (_input, ctx) => {
    const companyId = partnerCompanyId(ctx);
    await ensureProfileRow(companyId);

    const [profile, tagIds] = await Promise.all([
      queryOne<PartnerProfileRow>(
        'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
        [companyId],
      ),
      partnerTagIdsByFacet(companyId),
    ]);
    const strength = computeProfileStrength(readPillarValues(profile, tagIds));

    if (!strength.readyToComplete) {
      fail(
        invalidInput(
          `Still needed: ${strength.missingRequired
            .map((m) => m.label)
            .slice(0, 3)
            .join(", ")}`,
        ),
      );
    }

    const now = new Date();
    await updateRows(
      "PartnerProfile",
      { companyId },
      {
        onboardingCompletedAt: now,
        // Completing onboarding is itself an act of verification, so the
        // freshness clock starts here rather than waiting for a later confirm.
        lastVerifiedAt: now,
        profileStrength: strength.score,
        onboardingStep: null,
      },
    );

    revalidatePath("/partner");
    revalidatePath("/partner/profile");
    return { ok: true as const, strength: strength.score };
  },
});

/** Records where the partner is in the wizard so they can resume. */
export const setOnboardingStepAction = defineAction({
  name: "partner.onboarding.step",
  input: z.object({ step: z.string().max(40) }),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.onboarding.step", limit: 120, windowSec: 60 },
  skipAudit: true,
  handler: async ({ step }, ctx) => {
    const companyId = partnerCompanyId(ctx);
    await ensureProfileRow(companyId);
    await updateRows("PartnerProfile", { companyId }, { onboardingStep: step });
    return { ok: true as const };
  },
});

// ─── Freshness ───────────────────────────────────────────────────

export const confirmProfileAccurateAction = defineAction({
  name: "partner.profile.confirm",
  input: z.object({}).default({}),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.profile.confirm", limit: 10, windowSec: 3600 },
  handler: async (_input, ctx) => {
    const companyId = partnerCompanyId(ctx);
    await ensureProfileRow(companyId);
    await updateRows(
      "PartnerProfile",
      { companyId },
      { lastVerifiedAt: new Date() },
    );
    revalidatePath("/partner");
    revalidatePath("/partner/profile");
    return { ok: true as const };
  },
});

// ─── Re-scrape change proposals ──────────────────────────────────

export const resolveChangeProposalAction = defineAction({
  name: "partner.proposal.resolve",
  input: z.object({
    proposalId: z.string().min(1),
    decision: z.enum(["accept", "reject"]),
  }),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.proposal.resolve", limit: 100, windowSec: 60 },
  handler: async ({ proposalId, decision }, ctx) => {
    const companyId = partnerCompanyId(ctx);

    const proposal = await queryOne<{
      id: string;
      companyId: string;
      fieldKey: string;
      proposedValue: string | null;
      status: string;
    }>(
      'SELECT "id","companyId","fieldKey","proposedValue","status" FROM "ProfileChangeProposal" WHERE "id" = $1',
      [proposalId],
    );

    if (!proposal || proposal.companyId !== companyId) {
      fail({ code: "NOT_FOUND", resource: "Suggested change" });
    }
    if (proposal!.status !== "pending") {
      fail({ code: "CONFLICT", reason: "That proposal was already resolved." });
    }

    if (decision === "accept") {
      await applyProposal(companyId, proposal!.fieldKey, proposal!.proposedValue);
    }

    await updateRows(
      "ProfileChangeProposal",
      { id: proposalId },
      {
        status: decision === "accept" ? "accepted" : "rejected",
        resolvedById: ctx.user?.id ?? null,
        resolvedAt: new Date(),
      },
    );

    const strength = await refreshProfileStrength(companyId);
    revalidatePath("/partner/profile");
    revalidatePath("/partner");
    return { ok: true as const, strength };
  },
});

/**
 * Apply one accepted proposal.
 *
 * Proposals only ever target plain profile columns — never tags. Tag changes
 * would need facet resolution and cap enforcement, which is a decision the
 * partner should make in the editor with the picker in front of them, not by
 * accepting an opaque diff.
 */
async function applyProposal(
  companyId: string,
  fieldKey: string,
  proposedValue: string | null,
): Promise<void> {
  const SCRAPEABLE_COLUMNS = new Set([
    "tagline",
    "description",
    "website",
    "headquarters",
    "teamSize",
    "industry",
    "gcpTier",
    "partnerSince",
    "logoUrl",
  ]);

  if (!SCRAPEABLE_COLUMNS.has(fieldKey)) return;
  await exec(
    `UPDATE "PartnerProfile" SET "${fieldKey}" = $1, "updatedAt" = NOW() WHERE "companyId" = $2`,
    [proposedValue, companyId],
  );
}

// ─── Read helper for pillar labels (server components) ───────────

export async function pillarLabelsFor(
  tagIds: string[],
): Promise<Record<string, string>> {
  const tags = await tagsByIds(tagIds);
  return Object.fromEntries(tags.map((t) => [t.id, t.label]));
}
