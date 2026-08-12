"use server";

/**
 * Engagements — acceptance as a first-class event (plan-A gap 1.5).
 *
 * The pipeline previously ended before the actual business event:
 * selection → reveal → meeting → a self-reported outcome. There was no
 * record of *what was agreed*, so the platform could not answer "what
 * did this customer actually buy?" — and had no fee basis.
 *
 * Flow:
 *   1. Admin drafts the engagement from the accepted proposal, with the
 *      agreed scope and commercial terms.
 *   2. The customer acknowledges it (`acceptEngagementAction`), which is
 *      the acceptance event. Evidence (who/when/IP/UA) is captured to
 *      the same standard as partner T&C acceptance.
 *   3. Milestones track delivery; marking the engagement delivered is
 *      what completes the lead.
 *
 * Scope note: acknowledgement, not e-signature. Wiring a signature
 * provider is a separate commercial/legal decision.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { exec, insertRow, query, queryOne, updateRows } from "@/lib/db";
import { getLeadState, transitionLead } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { notify, notifyAdmins, notifyCompanyUsers } from "@/lib/notify";

const MoneyCents = z.coerce.number().int().nonnegative().max(1_000_000_000_00);

// ─── 1. Admin drafts the engagement ───────────────────────────────

const DraftEngagementInput = z.object({
  matchId: z.string().min(1),
  acceptedScope: z.string().trim().min(10).max(20_000),
  contractValueCents: MoneyCents.optional(),
  currency: z.string().trim().length(3).default("EUR"),
  startDate: z.string().trim().optional(),
  durationMonths: z.coerce.number().int().positive().max(120).optional(),
  /** Null until the commercial model is decided — see the migration. */
  feeModel: z.enum(["percentage", "flat", "none"]).optional(),
  feeBps: z.coerce.number().int().min(0).max(10_000).optional(),
  feeAmountCents: MoneyCents.optional(),
});

export const draftEngagementAction = defineAction({
  name: "engagement.draft",
  input: DraftEngagementInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "engagement.draft", limit: 30, windowSec: 300 },
  handler: async (data) => {
    const match = await queryOne<{
      id: string;
      briefId: string;
      partnerId: string;
      status: string;
      companyId: string;
      briefTitle: string;
      proposalId: string | null;
    }>(
      `SELECT m."id", m."briefId", m."partnerId", m."status",
              b."companyId", b."title" AS "briefTitle",
              p."id" AS "proposalId"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       LEFT JOIN "Proposal" p ON p."matchId" = m."id"
       WHERE m."id" = $1`,
      [data.matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
    if (match!.status !== "SELECTED") {
      fail({
        code: "CONFLICT",
        reason: "Only the selected partner can be turned into an engagement.",
      });
    }

    const engagement = await insertRow<{ id: string }>(
      "Engagement",
      {
        briefId: match!.briefId,
        matchId: match!.id,
        proposalId: match!.proposalId,
        partnerId: match!.partnerId,
        companyId: match!.companyId,
        status: "PENDING_ACCEPTANCE",
        acceptedScope: data.acceptedScope,
        contractValueCents: data.contractValueCents ?? null,
        currency: data.currency,
        startDate: data.startDate ? new Date(data.startDate) : null,
        durationMonths: data.durationMonths ?? null,
        feeModel: data.feeModel ?? null,
        feeBps: data.feeBps ?? null,
        feeAmountCents: data.feeAmountCents ?? null,
      },
      {
        onConflict: `("matchId") DO UPDATE SET
          "acceptedScope" = EXCLUDED."acceptedScope",
          "contractValueCents" = EXCLUDED."contractValueCents",
          "currency" = EXCLUDED."currency",
          "startDate" = EXCLUDED."startDate",
          "durationMonths" = EXCLUDED."durationMonths",
          "feeModel" = EXCLUDED."feeModel",
          "feeBps" = EXCLUDED."feeBps",
          "feeAmountCents" = EXCLUDED."feeAmountCents",
          "updatedAt" = NOW()`,
      },
    );

    await notifyCompanyUsers(match!.companyId, {
      event: "engagement.ready_for_acceptance",
      vars: { briefTitle: match!.briefTitle },
      link: `/briefs/${match!.briefId}/engagement`,
      briefId: match!.briefId,
    });

    revalidatePath(`/admin/briefs/${match!.briefId}`);
    revalidatePath(`/briefs/${match!.briefId}/engagement`);
    return { engagementId: engagement.id };
  },
});

// ─── 2. Customer accepts — the business event ─────────────────────

export const acceptEngagementAction = defineAction({
  name: "engagement.accept",
  input: z.object({
    engagementId: z.string().min(1),
    acceptedByName: z.string().trim().min(2).max(120),
    authorityChecked: z.boolean(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
  }),
  permission: "proposal.pin-winner",
  rateLimit: { scope: "engagement.accept", limit: 10, windowSec: 60 },
  handler: async (data, ctx) => {
    if (!data.authorityChecked) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "authorityChecked",
            message:
              "Please confirm you have authority to accept on behalf of your company.",
          },
        ],
      });
    }

    const engagement = await queryOne<{
      id: string;
      briefId: string;
      companyId: string;
      partnerId: string;
      status: string;
      briefTitle: string;
    }>(
      `SELECT e."id", e."briefId", e."companyId", e."partnerId", e."status",
              b."title" AS "briefTitle"
       FROM "Engagement" e
       JOIN "ProjectBrief" b ON b."id" = e."briefId"
       WHERE e."id" = $1`,
      [data.engagementId],
    );
    if (!engagement) fail({ code: "NOT_FOUND", resource: "Engagement" });
    if (engagement!.companyId !== ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Not your engagement" });
    }
    if (engagement!.status === "ACTIVE") {
      return { ok: true as const, alreadyAccepted: true };
    }
    if (engagement!.status !== "PENDING_ACCEPTANCE") {
      fail({
        code: "CONFLICT",
        reason: `Engagement is ${engagement!.status.toLowerCase()}.`,
      });
    }

    await updateRows(
      "Engagement",
      { id: engagement!.id },
      {
        status: "ACTIVE",
        acceptedAt: new Date(),
        acceptedById: ctx.user!.id,
        acceptedByName: data.acceptedByName,
        acceptedIp: data.ipAddress ?? null,
        acceptedUa: data.userAgent ?? null,
      },
    );

    const partnerUsers = await query<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "companyId" = $1',
      [engagement!.partnerId],
    );
    await notify({
      event: "engagement.accepted",
      recipients: partnerUsers.map((u) => ({ userId: u.id })),
      vars: { briefTitle: engagement!.briefTitle },
      link: `/partner/briefs/${engagement!.briefId}`,
      briefId: engagement!.briefId,
      idemKey: `engagement-accepted:${engagement!.id}`,
    });
    await notifyAdmins({
      event: "engagement.accepted_admin",
      vars: {
        briefTitle: engagement!.briefTitle,
        acceptedByName: data.acceptedByName,
      },
      link: `/admin/briefs/${engagement!.briefId}`,
      briefId: engagement!.briefId,
      idemKey: `engagement-accepted-admin:${engagement!.id}`,
    });

    revalidatePath(`/briefs/${engagement!.briefId}/engagement`);
    revalidatePath(`/admin/briefs/${engagement!.briefId}`);
    return { ok: true as const, alreadyAccepted: false };
  },
});

// ─── 3. Delivery ──────────────────────────────────────────────────

export const upsertMilestoneAction = defineAction({
  name: "engagement.milestone.upsert",
  input: z.object({
    engagementId: z.string().min(1),
    milestoneId: z.string().min(1).optional(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    dueDate: z.string().trim().optional(),
    status: z
      .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"])
      .default("PENDING"),
    rank: z.coerce.number().int().min(0).max(999).default(0),
  }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "engagement.milestone", limit: 60, windowSec: 60 },
  handler: async (data) => {
    const engagement = await queryOne<{ id: string; briefId: string }>(
      'SELECT "id", "briefId" FROM "Engagement" WHERE "id" = $1',
      [data.engagementId],
    );
    if (!engagement) fail({ code: "NOT_FOUND", resource: "Engagement" });

    const values = {
      engagementId: data.engagementId,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status,
      rank: data.rank,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    };

    if (data.milestoneId) {
      await updateRows("EngagementMilestone", { id: data.milestoneId }, values);
    } else {
      await insertRow("EngagementMilestone", values);
    }

    revalidatePath(`/briefs/${engagement!.briefId}/engagement`);
    revalidatePath(`/admin/briefs/${engagement!.briefId}`);
    return { ok: true as const };
  },
});

/**
 * Mark the engagement delivered. This — not a self-reported form — is
 * what drives the lead to COMPLETED.
 */
export const markEngagementDeliveredAction = defineAction({
  name: "engagement.delivered",
  input: z.object({ engagementId: z.string().min(1) }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "engagement.delivered", limit: 30, windowSec: 60 },
  handler: async ({ engagementId }, ctx) => {
    const engagement = await queryOne<{
      id: string;
      briefId: string;
      companyId: string;
      status: string;
      briefTitle: string;
    }>(
      `SELECT e."id", e."briefId", e."companyId", e."status", b."title" AS "briefTitle"
       FROM "Engagement" e
       JOIN "ProjectBrief" b ON b."id" = e."briefId"
       WHERE e."id" = $1`,
      [engagementId],
    );
    if (!engagement) fail({ code: "NOT_FOUND", resource: "Engagement" });
    if (engagement!.status !== "ACTIVE") {
      fail({
        code: "CONFLICT",
        reason: "Only an accepted engagement can be marked delivered.",
      });
    }

    await exec(
      `UPDATE "Engagement" SET "status" = 'DELIVERED', "deliveredAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      [engagementId],
    );

    const state = await getLeadState(engagement!.briefId);
    if (state === "MEETINGS_SCHEDULED" || state === "DROPPED_OFF") {
      await transitionLead({
        briefId: engagement!.briefId,
        to: "COMPLETED",
        actor: userActor(ctx.user!.id, ctx.user!.companyId),
        reason: "Engagement delivered",
      });
    }

    await notifyCompanyUsers(engagement!.companyId, {
      event: "engagement.delivered",
      vars: { briefTitle: engagement!.briefTitle },
      link: `/briefs/${engagement!.briefId}/engagement`,
      briefId: engagement!.briefId,
      idemKey: `engagement-delivered:${engagementId}`,
    });

    revalidatePath(`/admin/briefs/${engagement!.briefId}`);
    revalidatePath(`/briefs/${engagement!.briefId}/engagement`);
    return { ok: true as const };
  },
});
