"use server";

/**
 * AI-ranked partner sourcing for an admin's triage room.
 *
 * Combines:
 *   1. **`scorePartnersForBrief()`** — deterministic, transparent scoring.
 *      Uses canonical tag overlap plus commercial and capacity gates for
 *      partners who have completed structured onboarding, and falls back to
 *      legacy string matching for those who haven't yet.
 *   2. **Claude rationale** — short "why this fits" explanation per
 *      partner, with strengths + caveats.
 *
 * The two layers are intentional: deterministic scoring is auditable
 * and budget-friendly; the LLM rationale is the bit a human admin
 * actually reads. We cache the rationale on `Match.matchRationale`
 * keyed by a prompt version + partner-profile hash so re-opening the
 * page doesn't burn tokens.
 *
 * Why we don't just ask Claude to rank: a model that can't see the
 * full partner roster (we wouldn't fit it in context anyway) ranks
 * unpredictably. Deterministic shortlist first → LLM only explains
 * the top-N.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow } from "@/lib/db";
import type {
  ProjectBriefRow,
  CompanyRow,
  PartnerProfileRow,
} from "@/lib/db/rows";
import { scorePartnersForBrief } from "@/lib/match-load";
import { parseLlmJson } from "@/lib/ai/parse";
import {
  SourcingRationaleV1,
  SOURCING_RATIONALE_VERSION,
} from "@/lib/schemas/ai/sourcing-rationale";

const TOP_N_DEFAULT = 5;

const SOURCING_SYSTEM = `You are AI Partner's senior matchmaker explaining to an admin why a specific Google Cloud delivery partner fits a customer's brief.

Be concrete. Reference *specific* aspects of the partner's profile
that map to the brief (tier, certifications, regions, case studies).
Avoid platitudes ("great team", "strong delivery").

Output ONLY a single JSON object — no prose, no code fences — matching this schema:

{
  "confidence": 0-100 integer,
  "rationale": "1-2 sentences. Concrete. Cite the brief specifics.",
  "strengths": ["short keyword 1", "short keyword 2", ...],
  "caveats": ["short caveat 1", ...]
}

Max 5 strengths, max 3 caveats. If the partner is a poor fit, set
confidence low and put the reasons in "caveats" instead of inventing
strengths.`;

function buildSourcingUser(opts: {
  briefTitle: string;
  briefExecutiveSummary: string | null;
  briefServices: string[];
  briefRegion: string | null;
  briefCertifications: string | null;
  partnerName: string;
  partnerTier: string | null;
  partnerSpecializations: string[];
  partnerRegions: string[];
  partnerCertifications: string[];
  partnerCaseStudies: { title: string; industry?: string }[];
  deterministicScore: number;
  deterministicReasons: string[];
}): string {
  return [
    `# Brief`,
    `Title: ${opts.briefTitle}`,
    opts.briefExecutiveSummary
      ? `Summary: ${opts.briefExecutiveSummary.slice(0, 800)}`
      : `Summary: (empty)`,
    `Services needed: ${opts.briefServices.join(", ") || "(unspecified)"}`,
    `Preferred region: ${opts.briefRegion ?? "(any)"}`,
    opts.briefCertifications
      ? `Required certifications: ${opts.briefCertifications.slice(0, 400)}`
      : `Required certifications: (none)`,
    ``,
    `# Partner: ${opts.partnerName}`,
    `Tier: ${opts.partnerTier ?? "(unknown)"}`,
    `Specializations: ${opts.partnerSpecializations.join(", ") || "(unspecified)"}`,
    `Regions: ${opts.partnerRegions.join(", ") || "(unspecified)"}`,
    `Certifications: ${opts.partnerCertifications.join(", ") || "(unspecified)"}`,
    `Case studies: ${
      opts.partnerCaseStudies
        .slice(0, 3)
        .map((c) => `${c.title}${c.industry ? ` (${c.industry})` : ""}`)
        .join("; ") || "(none on file)"
    }`,
    ``,
    `# Deterministic scoring`,
    `Score: ${opts.deterministicScore}/100`,
    `Reasons: ${opts.deterministicReasons.join("; ")}`,
  ].join("\n");
}

function partnerProfileHash(profile: {
  tier: string | null;
  specializations: string[];
  regions: string[];
  certifications: { name: string }[];
}): string {
  return createHash("sha256")
    .update(JSON.stringify(profile))
    .digest("hex")
    .slice(0, 32);
}

// ─── Action: rank partners for a brief ───────────────────────────

const RankPartnersInput = z.object({
  briefId: z.string().min(1),
  topN: z.coerce.number().int().min(1).max(10).optional().default(TOP_N_DEFAULT),
  /** Skip cache and regenerate rationale for the top-N. */
  force: z.boolean().optional().default(false),
});

export const aiRankPartnersAction = defineAction({
  name: "admin.sourcing.rank",
  input: RankPartnersInput,
  output: z.object({
    items: z.array(
      z.object({
        partnerId: z.string(),
        partnerName: z.string(),
        score: z.number(),
        label: z.string(),
        rationale: z.string().nullable(),
        confidence: z.number().int().nullable(),
        strengths: z.array(z.string()),
        caveats: z.array(z.string()),
        reasons: z.array(z.string()),
      }),
    ),
  }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.sourcing.rank", limit: 20, windowSec: 600 },
  handler: async ({ briefId, topN, force }) => {
    const brief = await queryOne<ProjectBriefRow>(
      'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Vetting gate: only admin-approved partners are sourceable. A
    // self-registered company stays invisible until it is reviewed.
    const partnerCompanies = await query<CompanyRow>(
      `SELECT * FROM "Company"
       WHERE "kind" = 'PARTNER' AND "verificationStatus" = 'APPROVED'`,
    );
    const profiles = await query<PartnerProfileRow>(
      `SELECT * FROM "PartnerProfile" WHERE "companyId" = ANY($1)`,
      [partnerCompanies.map((c) => c.id)],
    );
    const profileByCompany = new Map(profiles.map((p) => [p.companyId, p]));
    const partners = partnerCompanies.map((c) => ({
      ...c,
      partnerProfile: profileByCompany.get(c.id) ?? null,
    }));

    // 1. Deterministic scoring across the whole partner roster.
    //
    // Tag-based where the partner has completed structured onboarding, legacy
    // string overlap otherwise — see `scorePartnersForBrief`. Gated partners
    // (below minimum deal size, cannot mobilise, missing required compliance)
    // are pushed below every eligible one rather than filtered out, so an admin
    // can still see and override them.
    const unified = await scorePartnersForBrief(brief!, partners);
    const scored = partners
      .map((p) => ({ partner: p, match: unified.get(p.id)! }))
      .sort((a, b) => {
        if (a.match.eligible !== b.match.eligible) {
          return a.match.eligible ? -1 : 1;
        }
        return b.match.score - a.match.score;
      });

    const top = scored.slice(0, topN);

    // 2. Rationale per top-N: cache hit when (partner profile hash,
    //    prompt version, brief id) all match.
    const items = await Promise.all(
      top.map(async ({ partner, match: breakdown }) => {
        const profile = partner.partnerProfile;
        const profileHash = partnerProfileHash({
          tier: profile?.tier ?? null,
          specializations: safeArr(profile?.specializations),
          regions: safeArr(profile?.regions),
          certifications: safeArr<{ name: string }>(profile?.certifications),
        });

        const cached = await queryOne<{
          matchRationale: string | null;
          matchRationaleVer: string | null;
        }>(
          `SELECT "matchRationale", "matchRationaleVer"
           FROM "Match" WHERE "briefId" = $1 AND "partnerId" = $2`,
          [briefId, partner.id],
        );

        const cacheKey = `${SOURCING_RATIONALE_VERSION}:${profileHash}`;
        if (
          !force &&
          cached?.matchRationale &&
          cached.matchRationaleVer === cacheKey
        ) {
          const parsed = safeJson<SourcingRationaleV1>(cached.matchRationale);
          if (parsed) {
            await persistScore(briefId, partner.id, breakdown.score);
            return shape(partner, breakdown, parsed);
          }
        }

        // Call Claude.
        const result = await parseLlmJson({
          schema: SourcingRationaleV1,
          system: SOURCING_SYSTEM,
          user: buildSourcingUser({
            briefTitle: brief!.title,
            briefExecutiveSummary: brief!.executiveSummary,
            briefServices: safeArr<string>(brief!.services),
            briefRegion: brief!.preferredLocation,
            briefCertifications: brief!.requiredCertifications,
            partnerName: partner.name,
            partnerTier: profile?.tier ?? null,
            partnerSpecializations: safeArr<string>(profile?.specializations),
            partnerRegions: safeArr<string>(profile?.regions),
            partnerCertifications: safeArr<{ name: string }>(
              profile?.certifications,
            ).map((c) => c.name),
            partnerCaseStudies: safeArr<{
              title: string;
              industry?: string;
            }>(profile?.caseStudies),
            deterministicScore: breakdown.score,
            deterministicReasons: breakdown.reasons,
          }),
          tag: "ai-sourcing",
          maxTokens: 800,
          temperature: 0.2,
        });

        if (!result.ok) {
          // Don't fail the whole ranking — just return the
          // deterministic breakdown without rationale.
          await persistScore(briefId, partner.id, breakdown.score);
          return shape(partner, breakdown, null);
        }

        // Cache result on the (potentially yet-to-exist) Match row.
        await insertRow(
          "Match",
          {
            briefId,
            partnerId: partner.id,
            status: "SOURCED",
            matchRationale: JSON.stringify(result.data),
            matchRationaleVer: cacheKey,
            matchScore: breakdown.score,
          },
          {
            onConflict: `("briefId", "partnerId") DO UPDATE SET
              "matchRationale" = EXCLUDED."matchRationale",
              "matchRationaleVer" = EXCLUDED."matchRationaleVer",
              "matchScore" = EXCLUDED."matchScore",
              "updatedAt" = EXCLUDED."updatedAt"`,
          },
        );

        return shape(partner, breakdown, result.data);
      }),
    );

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}/triage`);
    return { items };
  },
});

// ─── Helpers ─────────────────────────────────────────────────────

function safeArr<T = string>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (typeof input === "string") {
    try {
      const v = JSON.parse(input);
      return Array.isArray(v) ? (v as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

async function persistScore(briefId: string, partnerId: string, score: number) {
  await insertRow(
    "Match",
    {
      briefId,
      partnerId,
      status: "SOURCED",
      matchScore: score,
    },
    {
      onConflict: `("briefId", "partnerId") DO UPDATE SET
        "matchScore" = EXCLUDED."matchScore",
        "updatedAt" = EXCLUDED."updatedAt"`,
    },
  );
}

function shape(
  partner: { id: string; name: string },
  breakdown: { score: number; label: string; reasons: string[] },
  rationale: SourcingRationaleV1 | null,
) {
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    score: breakdown.score,
    label: breakdown.label,
    rationale: rationale?.rationale ?? null,
    confidence: rationale?.confidence ?? null,
    strengths: rationale?.strengths ?? [],
    caveats: rationale?.caveats ?? [],
    reasons: breakdown.reasons,
  };
}
