"use server";

/**
 * Admin-only Server Actions — triage, sourcing, matching, shortlist
 * narrowing, meeting confirmation.
 *
 * All wrapped in `defineAction` for Zod validation, RBAC, rate
 * limiting, and audit logging. Returns `ActionResult<T>` — callers
 * must pattern-match on `result.ok`.
 *
 * **Step-up auth** applies to destructive ops: removing a match,
 * forcing a stage change, etc.
 */

import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { requireStepUp } from "@/lib/step-up";
import { query, queryOne, exec, insertRow, updateRows, tx } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { BRIEF_STAGES } from "@/lib/enums";
import { renderPartnerOutreach } from "@/lib/email-templates";
import { sendOutreachEmail } from "@/lib/email/outreach";

// ─── Stage change ─────────────────────────────────────────────────

const ChangeStageInput = z.object({
  briefId: z.string().min(1),
  stage: z.enum(BRIEF_STAGES),
});

export const adminChangeStageAction = defineAction({
  name: "admin.brief.change-stage",
  input: ChangeStageInput,
  permission: "brief.update",
  rateLimit: { scope: "admin.brief.change-stage", limit: 60, windowSec: 60 },
  handler: async ({ briefId, stage }) => {
    await updateRows("ProjectBrief", { id: briefId }, { stage });
    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath("/admin/briefs");
    return { ok: true as const };
  },
});

// ─── Assign / propose a partner ───────────────────────────────────

const AssignPartnerInput = z.object({
  briefId: z.string().min(1),
  partnerId: z.string().min(1),
});

export const adminAssignPartnerAction = defineAction({
  name: "admin.partner.assign",
  input: AssignPartnerInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.assign", limit: 30, windowSec: 60 },
  handler: async ({ briefId, partnerId }) => {
    // Admin proposes a match — SOURCED == "awaiting customer approval".
    await insertRow(
      "Match",
      { briefId, partnerId, status: "SOURCED" },
      {
        onConflict: `("briefId", "partnerId") DO UPDATE SET
          "status" = 'SOURCED',
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    await exec(
      `UPDATE "ProjectBrief" SET "stage" = 'REVIEW', "updatedAt" = NOW()
       WHERE "id" = $1 AND "stage" IN ('INTAKE', 'SOURCING')`,
      [briefId],
    );

    const brief = await queryOne<{ ownerId: string; title: string }>(
      'SELECT "ownerId", "title" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    const partner = await queryOne<{ name: string }>(
      'SELECT "name" FROM "Company" WHERE "id" = $1',
      [partnerId],
    );
    if (brief && partner) {
      await insertRow("Notification", {
        userId: brief.ownerId,
        type: "match.proposed",
        title: `${partner.name} proposed as partner`,
        message: `Our team identified ${partner.name} as a strong fit for "${brief.title}". Review and approve to share your SoW.`,
        link: `/briefs/${briefId}/preview`,
      });
    }

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath(`/dashboard`);
    return { ok: true as const };
  },
});

// ─── Remove a match (destructive — step-up) ───────────────────────

const RemoveMatchInput = z.object({
  matchId: z.string().min(1),
});

export const adminRemoveMatchAction = defineAction({
  name: "admin.match.remove",
  input: RemoveMatchInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.match.remove", limit: 20, windowSec: 60 },
  handler: async ({ matchId }, ctx) => {
    // Destructive — re-prove MFA in the last 5 minutes (soft-launch:
    // only enforced once the user has enrolled).
    if (ctx.user) {
      await requireStepUp({
        userId: ctx.user.id,
        forAction: "admin.match.remove",
      });
    }
    const m = await queryOne<{ id: string; briefId: string }>(
      'SELECT "id", "briefId" FROM "Match" WHERE "id" = $1',
      [matchId],
    );
    if (!m) fail({ code: "NOT_FOUND", resource: "Match" });
    await exec('DELETE FROM "Match" WHERE "id" = $1', [matchId]);
    revalidatePath(`/admin/briefs/${m!.briefId}`);
    return { ok: true as const };
  },
});

// ─── Triage workflow ──────────────────────────────────────────────

const MarkTriagedInput = z.object({
  briefId: z.string().min(1),
  notes: z.string().trim().max(4000).optional(),
});

export const markBriefTriagedAction = defineAction({
  name: "admin.brief.triage",
  input: MarkTriagedInput,
  permission: "admin.triage",
  rateLimit: { scope: "admin.brief.triage", limit: 60, windowSec: 60 },
  handler: async ({ briefId, notes }, ctx) => {
    const brief = await queryOne<ProjectBriefRow>(
      'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    await updateRows(
      "ProjectBrief",
      { id: briefId },
      {
        triagedAt: new Date(),
        triagedBy: ctx.user!.id,
        triageNotes: notes ?? brief!.triageNotes,
        stage: brief!.stage === "INTAKE" ? "SOURCING" : brief!.stage,
      },
    );

    await insertRow("Notification", {
      userId: brief!.ownerId,
      type: "brief.triaged",
      title: "Your brief is now in active sourcing",
      message:
        "Our team confirmed your project as a real lead. We're identifying the top 5 partner matches.",
      link: `/briefs/${briefId}/preview`,
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}/triage`);
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath("/admin");
    return { ok: true as const };
  },
});

// ─── Confirm a customer-proposed meeting slot ─────────────────────

const ConfirmMeetingInput = z.object({
  briefId: z.string().min(1),
  slotIndex: z.coerce.number().int().min(0).max(2),
});

export const confirmMeetingSlotAction = defineAction({
  name: "admin.meeting.confirm",
  input: ConfirmMeetingInput,
  permission: "admin.triage",
  rateLimit: { scope: "admin.meeting.confirm", limit: 30, windowSec: 60 },
  handler: async ({ briefId, slotIndex }, ctx) => {
    const brief = await queryOne<ProjectBriefRow>(
      'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    let slots: { startsAt: string; durationMins: number }[] = [];
    try {
      slots = JSON.parse(brief!.meetingProposedSlots);
    } catch {
      slots = [];
    }
    const chosen = slots[slotIndex];
    if (!chosen) {
      fail({ code: "CONFLICT", reason: "Slot is no longer available." });
    }

    await updateRows(
      "ProjectBrief",
      { id: briefId },
      {
        meetingConfirmedAt: new Date(chosen!.startsAt),
        meetingConfirmedBy: ctx.user!.id,
      },
    );

    await insertRow("Notification", {
      userId: brief!.ownerId,
      type: "meeting.confirmed",
      title: "Alignment meeting confirmed",
      message: `Your meeting with the AI Partner team is confirmed for ${new Date(chosen!.startsAt).toLocaleString()}.`,
      link: `/briefs/${briefId}/preview`,
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}/triage`);
    revalidatePath(`/briefs/${briefId}/preview`);
    return { ok: true as const };
  },
});

// ─── Source 5 partners ────────────────────────────────────────────

const SourcePartnersInput = z.object({
  briefId: z.string().min(1),
  selections: z
    .array(
      z.object({
        partnerId: z.string().min(1),
        recipientEmail: z.string().email(),
        customSubject: z.string().optional(),
        customBody: z.string().optional(),
      }),
    )
    .min(1, "Select at least one partner")
    .max(5, "Up to 5 partners only"),
});

function newToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export const sourcePartnersAction = defineAction({
  name: "admin.partners.source",
  input: SourcePartnersInput,
  output: z.object({ invited: z.number().int().nonnegative() }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partners.source", limit: 20, windowSec: 60 },
  handler: async ({ briefId, selections }) => {
    const brief = await queryOne<
      ProjectBriefRow & { anonymizedProfile: string | null }
    >(
      `SELECT b.*, cp."anonymizedProfile"
       FROM "ProjectBrief" b
       LEFT JOIN "CustomerProfile" cp ON cp."companyId" = b."companyId"
       WHERE b."id" = $1`,
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    let customerIndustry = "Not specified";
    let customerRegion = brief!.preferredLocation ?? "Not specified";
    const anonRaw = brief!.anonymizedProfile;
    if (anonRaw) {
      try {
        const a = JSON.parse(anonRaw);
        if (a?.industry) customerIndustry = String(a.industry);
        if (a?.region) customerRegion = String(a.region);
      } catch {
        /* ignore */
      }
    }

    const briefSummary =
      brief!.executiveSummary?.trim().slice(0, 1000) ??
      "Detailed scope will be shared upon acceptance of the lead terms.";

    let invited = 0;
    for (const sel of selections) {
      const partner = await queryOne<{ id: string; name: string }>(
        'SELECT "id", "name" FROM "Company" WHERE "id" = $1',
        [sel.partnerId],
      );
      if (!partner) continue;

      const outreachToken = newToken();

      const { subject, body } = renderPartnerOutreach({
        partnerName: partner.name,
        partnerCompany: partner.name,
        recipientEmail: sel.recipientEmail,
        customerIndustry,
        customerRegion,
        briefSummary,
        briefTitle: brief!.title,
        acceptUrl: `https://aipartner.cloud/partner/accept/${outreachToken}`,
      });
      const finalSubject = sel.customSubject?.trim() || subject;
      const finalBody = sel.customBody?.trim() || body;

      const match = await insertRow<{ id: string }>(
        "Match",
        {
          briefId,
          partnerId: partner.id,
          status: "INVITED",
          outreachToken,
          outreachEmail: sel.recipientEmail.toLowerCase(),
        },
        {
          onConflict: `("briefId", "partnerId") DO UPDATE SET
            "status" = 'INVITED',
            "outreachToken" = EXCLUDED."outreachToken",
            "outreachEmail" = EXCLUDED."outreachEmail",
            "updatedAt" = EXCLUDED."updatedAt"`,
        },
      );

      await sendOutreachEmail({
        matchId: match.id,
        recipientEmail: sel.recipientEmail.toLowerCase(),
        subject: finalSubject,
        body: finalBody,
        notification: {
          type: "partner.outreach",
          title: "New AI Partner opportunity",
          message: `An opportunity for "${brief!.title}" has been shared with you.`,
          link: `/partner/accept/${outreachToken}`,
        },
      });

      invited++;
    }

    await updateRows("ProjectBrief", { id: briefId }, { stage: "SHORTLIST" });

    await insertRow("Notification", {
      userId: brief!.ownerId,
      type: "shortlist.created",
      title: "5 partners contacted — shortlist building",
      message:
        "We've sent the opportunity to your top partner matches. We'll show you who accepts so you can narrow to 3.",
      link: `/briefs/${briefId}/shortlist`,
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}/triage`);
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath(`/briefs/${briefId}/shortlist`);
    return { invited };
  },
});

// ─── Customer 5 → 3 shortlist narrowing ───────────────────────────

const NarrowShortlistInput = z.object({
  briefId: z.string().min(1),
  /** Ordered: index 0 = priority 1, etc. */
  finalThreeMatchIds: z.array(z.string().min(1)).min(1).max(3),
});

export const narrowShortlistAction = defineAction({
  name: "match.narrow",
  input: NarrowShortlistInput,
  permission: "match.narrow",
  rateLimit: { scope: "match.narrow", limit: 10, windowSec: 60 },
  handler: async ({ briefId, finalThreeMatchIds }) => {
    const brief = await queryOne<{
      id: string;
      ownerId: string;
      title: string;
    }>(
      'SELECT "id", "ownerId", "title" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    await tx(async (client) => {
      await client.query(
        `UPDATE "Match" SET "status" = 'SHORTLISTED', "customerPriority" = NULL,
           "updatedAt" = NOW()
         WHERE "briefId" = $1
           AND "status" IN ('IN_FINAL_THREE', 'PARTNER_ACCEPTED', 'SHORTLISTED')`,
        [briefId],
      );
      for (let i = 0; i < finalThreeMatchIds.length; i++) {
        await client.query(
          `UPDATE "Match" SET "status" = 'IN_FINAL_THREE',
             "customerPriority" = $2, "updatedAt" = NOW()
           WHERE "id" = $1`,
          [finalThreeMatchIds[i], i + 1],
        );
      }
      await client.query(
        `UPDATE "ProjectBrief" SET "stage" = 'SELECTION', "updatedAt" = NOW()
         WHERE "id" = $1`,
        [briefId],
      );
    });

    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
    );
    for (const a of admins) {
      await insertRow("Notification", {
        userId: a.id,
        type: "shortlist.narrowed",
        title: "Customer picked their final 3",
        message: `"${brief!.title}" — coordinate meetings with the top 3 partners.`,
        link: `/admin/briefs/${briefId}`,
      });
    }

    revalidatePath(`/briefs/${briefId}/shortlist`);
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});

// ─── Legacy aliases ───────────────────────────────────────────────
//
// Internal call sites used these names before the migration. Re-exporting
// keeps imports stable until the call sites are updated.

export {
  adminChangeStageAction as adminChangeStage,
  adminAssignPartnerAction as adminAssignPartner,
  adminRemoveMatchAction as adminRemoveMatch,
};
