"use server";

/**
 * M7 — structured proposal builder + internal approval (plan-A §6 M7).
 *
 *   - Sections follow the canonical proposal registry (§6.7) so QC,
 *     anonymization and the comparison grid line up 1:1.
 *   - Pricing is structured (fixed / T&M / tiered / resell options).
 *   - Submission requires an explicit internal approval (M7.4) —
 *     admins CANNOT perform it (§2.2 ⛔), only partner users.
 *   - Submitting: proposal SM → SUBMITTED, invite SM →
 *     PROPOSAL_SUBMITTED, T2 satisfied, admins notified with the
 *     submission order, competing partners get the "war-zone"
 *     notification (toggleable, §7).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, count, insertRow, updateRows } from "@/lib/db";
import type { ProposalRow } from "@/lib/db/rows";
import {
  PROPOSAL_SECTIONS,
  isProposalSectionKey,
  mandatoryProposalKeys,
  PRICING_MODELS,
} from "@/lib/sections";
import { transitionProposal } from "@/lib/state-machine/proposal";
import { transitionInvite } from "@/lib/state-machine/invite";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { satisfyTimer, startTimer } from "@/lib/timers";
import { getSetting } from "@/lib/settings";
import { notify, notifyAdmins } from "@/lib/notify";

/** Get-or-create the draft proposal for a match (partner-side). */
async function ensureProposal(matchId: string, partnerCompanyId: string) {
  const match = await queryOne<{
    id: string;
    briefId: string;
    partnerId: string;
    status: string;
  }>(
    'SELECT "id", "briefId", "partnerId", "status" FROM "Match" WHERE "id" = $1',
    [matchId],
  );
  if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
  if (match!.partnerId !== partnerCompanyId) {
    fail({ code: "FORBIDDEN", reason: "Not your match" });
  }
  return insertRow<ProposalRow>(
    "Proposal",
    {
      briefId: match!.briefId,
      partnerId: match!.partnerId,
      matchId,
      status: "DRAFT",
    },
    {
      // No-op update so RETURNING gives us the existing row.
      onConflict: `("matchId") DO UPDATE SET "matchId" = EXCLUDED."matchId"`,
    },
  );
}

// ─── Save a section ───────────────────────────────────────────

const PricingPayload = z.object({
  model: z.enum(PRICING_MODELS),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        amountCents: z.number().int().nonnegative().optional(),
        unit: z.string().max(100).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .max(10)
    .default([]),
});

const SaveSectionInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1), // RBAC condition
  key: z.string().min(1),
  content: z.string().max(30_000).default(""),
  pricing: PricingPayload.optional(),
});

export const savePartnerProposalSectionAction = defineAction({
  name: "proposal.section.save",
  input: SaveSectionInput,
  permission: "proposal.update",
  rateLimit: { scope: "proposal.section.save", limit: 120, windowSec: 60 },
  handler: async ({ matchId, key, content, pricing }, ctx) => {
    if (!isProposalSectionKey(key)) {
      fail({ code: "NOT_FOUND", resource: "ProposalSection" });
    }
    const proposal = await ensureProposal(matchId, ctx.user!.companyId!);
    if (proposal.status !== "DRAFT" && proposal.status !== "CLARIFICATION_NEEDED") {
      fail({ code: "CONFLICT", reason: `Proposal is ${proposal.status} — sections are locked` });
    }

    await insertRow(
      "ProposalSection",
      {
        proposalId: proposal.id,
        key,
        content,
        pricing: pricing ? JSON.stringify(pricing) : null,
        rank: PROPOSAL_SECTIONS[key as keyof typeof PROPOSAL_SECTIONS].rank,
      },
      {
        onConflict:
          pricing !== undefined
            ? `("proposalId", "key") DO UPDATE SET
                "content" = EXCLUDED."content",
                "pricing" = EXCLUDED."pricing",
                "updatedAt" = EXCLUDED."updatedAt"`
            : `("proposalId", "key") DO UPDATE SET
                "content" = EXCLUDED."content",
                "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    // Keep the legacy summary columns in sync for older read paths.
    if (key === "approach") {
      await updateRows(
        "Proposal",
        { id: proposal.id },
        { approach: content, summary: content.slice(0, 500) },
      );
    }

    revalidatePath(`/partner/briefs/${proposal.briefId}`);
    return { ok: true as const, proposalId: proposal.id };
  },
});

// ─── Internal approval (M7.4) ─────────────────────────────────

const ApproveInternalInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1),
});

export const markProposalInternallyApprovedAction = defineAction({
  name: "proposal.approve-internal",
  input: ApproveInternalInput,
  permission: "proposal.approve-internal",
  rateLimit: { scope: "proposal.approve-internal", limit: 20, windowSec: 60 },
  handler: async ({ matchId }, ctx) => {
    const proposal = await queryOne<ProposalRow>(
      'SELECT * FROM "Proposal" WHERE "matchId" = $1',
      [matchId],
    );
    if (!proposal) fail({ code: "NOT_FOUND", resource: "Proposal" });

    await transitionProposal({
      proposalId: proposal!.id,
      to: "INTERNALLY_APPROVED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      data: {
        internalApprovedById: ctx.user!.id,
        internalApprovedAt: new Date(),
      },
    });

    revalidatePath(`/partner/briefs/${proposal!.briefId}`);
    return { ok: true as const };
  },
});

// ─── Submit ───────────────────────────────────────────────────

const SubmitInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1),
});

export const submitStructuredProposalAction = defineAction({
  name: "proposal.submit-structured",
  input: SubmitInput,
  output: z.object({ submissionRank: z.number() }),
  permission: "proposal.submit",
  rateLimit: { scope: "proposal.submit", limit: 10, windowSec: 60 },
  handler: async ({ matchId }, ctx) => {
    const proposal = await queryOne<
      ProposalRow & {
        proposalDeadlineAt: Date | null;
        briefTitle: string;
        partnerName: string;
      }
    >(
      `SELECT p.*, m."proposalDeadlineAt",
              b."title" AS "briefTitle", c."name" AS "partnerName"
       FROM "Proposal" p
       JOIN "Match" m ON m."id" = p."matchId"
       JOIN "ProjectBrief" b ON b."id" = p."briefId"
       JOIN "Company" c ON c."id" = p."partnerId"
       WHERE p."matchId" = $1`,
      [matchId],
    );
    if (!proposal) fail({ code: "NOT_FOUND", resource: "Proposal" });

    const sections = await query<{ key: string; content: string; pricing: string | null }>(
      'SELECT "key", "content", "pricing" FROM "ProposalSection" WHERE "proposalId" = $1',
      [proposal!.id],
    );

    // T2 guard — the sweep may not have expired the invite yet.
    if (proposal!.proposalDeadlineAt && proposal!.proposalDeadlineAt < new Date()) {
      fail({ code: "CONFLICT", reason: "The proposal deadline has passed" });
    }
    if (proposal!.status !== "INTERNALLY_APPROVED" && proposal!.status !== "DRAFT") {
      fail({
        code: "CONFLICT",
        reason:
          "Proposal must be in DRAFT status to submit",
      });
    }

    // Mandatory sections (M7.1): approach, scope_response, timeline,
    // resources_team, pricing, assumptions.
    const present = new Set(
      sections.filter((s) => s.content.trim() || s.pricing).map((s) => s.key),
    );
    const missing = mandatoryProposalKeys().filter((k) => !present.has(k));
    if (missing.length > 0) {
      fail({
        code: "CONFLICT",
        reason: `Missing mandatory sections: ${missing
          .map((k) => PROPOSAL_SECTIONS[k].label)
          .join(", ")}`,
      });
    }

    const submittedAt = new Date();
    await transitionProposal({
      proposalId: proposal!.id,
      to: "SUBMITTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      data: { submittedAt },
    });
    await transitionInvite({
      matchId,
      to: "PROPOSAL_SUBMITTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    await satisfyTimer("match", matchId, "proposal_submit");

    // Submission order — visible to the customer later (M6.7).
    const submissionRank = await count(
      `SELECT COUNT(*) AS count FROM "Proposal"
       WHERE "briefId" = $1 AND "submittedAt" IS NOT NULL AND "submittedAt" <= $2`,
      [proposal!.briefId, submittedAt],
    );

    // Lead moves to PROPOSALS_IN_REVIEW on the first submission.
    const leadState = await getLeadState(proposal!.briefId);
    if (leadState === "SENT_TO_PARTNERS") {
      await transitionLead({
        briefId: proposal!.briefId,
        to: "PROPOSALS_IN_REVIEW",
        actor: userActor(ctx.user!.id, ctx.user!.companyId),
      });
    }

    await notifyAdmins({
      event: "proposal.submitted_admin",
      vars: {
        briefTitle: proposal!.briefTitle,
        partnerName: proposal!.partnerName,
        submissionRank: String(submissionRank),
      },
      link: `/admin/briefs/${proposal!.briefId}`,
      briefId: proposal!.briefId,
      matchId,
      idemKey: `submitted:${proposal!.id}`,
    });

    // "War-zone" competitive notification to other accepted partners.
    const competitiveEnabled = await getSetting("competitive_notifications_enabled");
    if (competitiveEnabled) {
      const competitors = await query<{ id: string; partnerId: string }>(
        `SELECT "id", "partnerId" FROM "Match"
         WHERE "briefId" = $1 AND "id" <> $2
           AND "status" IN ('PARTNER_ACCEPTED', 'EXTENSION_REQUESTED')`,
        [proposal!.briefId, matchId],
      );
      for (const competitor of competitors) {
        const competitorUsers = await query<{ id: string }>(
          'SELECT "id" FROM "User" WHERE "companyId" = $1',
          [competitor.partnerId],
        );
        await notify({
          event: "invite.competitor_submitted",
          recipients: competitorUsers.map((u) => ({ userId: u.id })),
          vars: { briefTitle: proposal!.briefTitle },
          link: `/partner/briefs/${proposal!.briefId}`,
          briefId: proposal!.briefId,
          matchId: competitor.id,
          idemKey: `competitor:${proposal!.id}:${competitor.id}`,
        });
      }
    }

    revalidatePath(`/partner/briefs/${proposal!.briefId}`);
    revalidatePath(`/admin/briefs/${proposal!.briefId}`);
    return { submissionRank };
  },
});

/**
 * Partner withdraws their own submitted proposal back to DRAFT.
 *
 * Only before QC picks it up: once the proposal is in QC — and
 * certainly once the anonymized comparison has been released to the
 * customer — withdrawal would rewrite something the other side has
 * already seen, so it is refused and the partner must talk to an admin.
 *
 * The T2 deadline is deliberately NOT extended: the timer is restarted
 * against the original deadline so withdrawing can't buy extra time.
 */
export const withdrawProposalAction = defineAction({
  name: "proposal.withdraw",
  input: z.object({
    matchId: z.string().min(1),
    reason: z.string().trim().max(500).optional(),
  }),
  permission: "proposal.submit",
  rateLimit: { scope: "proposal.withdraw", limit: 10, windowSec: 60 },
  handler: async ({ matchId, reason }, ctx) => {
    const proposal = await queryOne<
      ProposalRow & {
        matchStatus: string;
        proposalDeadlineAt: Date | null;
        briefTitle: string;
        partnerName: string;
      }
    >(
      `SELECT p.*, m."status" AS "matchStatus", m."proposalDeadlineAt",
              b."title" AS "briefTitle", c."name" AS "partnerName"
       FROM "Proposal" p
       JOIN "Match" m ON m."id" = p."matchId"
       JOIN "ProjectBrief" b ON b."id" = p."briefId"
       JOIN "Company" c ON c."id" = p."partnerId"
       WHERE p."matchId" = $1`,
      [matchId],
    );
    if (!proposal) fail({ code: "NOT_FOUND", resource: "Proposal" });
    if (proposal!.partnerId !== ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Not your proposal" });
    }
    if (proposal!.status !== "SUBMITTED") {
      fail({
        code: "CONFLICT",
        reason:
          "Only a submitted proposal that hasn't entered QC can be withdrawn.",
      });
    }

    const leadState = await getLeadState(proposal!.briefId);
    if (leadState && leadState !== "SENT_TO_PARTNERS" && leadState !== "PROPOSALS_IN_REVIEW") {
      fail({
        code: "CONFLICT",
        reason:
          "The customer comparison has already been released — contact an admin to change your proposal.",
      });
    }

    const actor = userActor(ctx.user!.id, ctx.user!.companyId);
    await transitionProposal({
      proposalId: proposal!.id,
      to: "DRAFT",
      actor,
      reason: reason ?? "Withdrawn by partner",
      data: { submittedAt: null },
    });
    await transitionInvite({
      matchId,
      to: "PARTNER_ACCEPTED",
      actor,
      reason: reason ?? "Proposal withdrawn by partner",
    });

    // Re-arm T2 against the ORIGINAL deadline (never extended).
    if (proposal!.proposalDeadlineAt && proposal!.proposalDeadlineAt > new Date()) {
      await startTimer({
        entityType: "match",
        entityId: matchId,
        timerType: "proposal_submit",
        deadlineAt: proposal!.proposalDeadlineAt,
        meta: { briefId: proposal!.briefId, matchId },
      });
    }

    await notifyAdmins({
      event: "proposal.withdrawn_admin",
      vars: {
        briefTitle: proposal!.briefTitle,
        partnerName: proposal!.partnerName,
        reason: reason ?? "no reason given",
      },
      link: `/admin/briefs/${proposal!.briefId}`,
      briefId: proposal!.briefId,
      matchId,
    });

    revalidatePath(`/partner/briefs/${proposal!.briefId}`);
    revalidatePath(`/admin/briefs/${proposal!.briefId}`);
    return { ok: true as const };
  },
});
