"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne, exec, insertRow, updateRows, tx } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { computeCompletion } from "@/lib/brief";
import { buildOpeningMessage } from "@/lib/brief-prompts";
import { defineAction, fail } from "@/lib/actions/define";
import { hasOutstandingApprovals } from "@/lib/workspace-access";
import {
  CreateBriefInput,
  UpdateBriefInput,
  SubmitBriefInput,
  MatchActionInput,
  AdvanceStageInput,
  DeleteBriefInput,
  BRIEF_PATCH_ALLOWED_FIELDS,
  BRIEF_JSON_FIELDS,
} from "@/lib/schemas/brief";

// ─── Create ──────────────────────────────────────────────────────

/**
 * Create a brief from the 3-step qualification modal. Returns the new
 * brief id; caller redirects.
 */
export const createBriefAction = defineAction({
  name: "brief.create",
  input: CreateBriefInput,
  output: z.object({ briefId: z.string() }),
  permission: "brief.create",
  rateLimit: { scope: "brief.create", limit: 10, windowSec: 300 },
  handler: async (parsed, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "No company on account" });
    }
    const intentRoute = parsed.services.includes("RESELLING") ? "COMMERCIAL" : "TECHNICAL";
    const cloudContext = await queryOne(
      'SELECT * FROM "CompanyCloudContext" WHERE "companyId" = $1',
      [ctx.user.companyId],
    );
    const brief = await tx(async (client) => {
      const created = await insertRow<{ id: string }>("ProjectBrief", {
        title: parsed.title?.trim() || "New Project Brief",
        ownerId: ctx.user!.id,
        companyId: ctx.user!.companyId!,
        usesCloud: parsed.usesCloud ?? true,
        hadPartner: parsed.hadPartner ?? false,
        procurement: parsed.procurement ?? "UNSURE",
        procurementType:
          parsed.procurement && parsed.procurement !== "UNSURE"
            ? parsed.procurement
            : null,
        services: JSON.stringify(parsed.services),
        source: "ai_builder",
        intentRoute,
        deliveryModel: JSON.stringify(parsed.deliveryModel),
        cloudContextSnapshot: JSON.stringify(cloudContext ?? {}),
        targetGoLive: parsed.targetStartDate || null,
        budgetRange: parsed.estimatedBudget || null,
        stage: "INTAKE",
        status: "DRAFT",
      }, { client });
      await insertRow("BriefAccess", {
        briefId: created.id,
        userId: ctx.user!.id,
        role: "EDITOR",
        status: "ACTIVE",
        grantedById: ctx.user!.id,
      }, { client });
      await insertRow("ChatMessage", {
        briefId: created.id,
        role: "assistant",
        content: buildOpeningMessage(parsed.services, intentRoute),
      }, { client });
      return created;
    });
    revalidatePath("/dashboard");
    return { briefId: brief.id };
  },
});

// ─── Update ──────────────────────────────────────────────────────

export const updateBriefAction = defineAction({
  name: "brief.update",
  input: UpdateBriefInput,
  permission: "brief.update",
  rateLimit: { scope: "brief.update", limit: 60, windowSec: 60 },
  handler: async ({ briefId, patch }) => {
    // Allow-list every key — silently drop unknown ones rather than
    // mass-assign arbitrary columns.
    const data: Record<string, unknown> = {};
    for (const key of BRIEF_PATCH_ALLOWED_FIELDS) {
      if (!(key in patch)) continue;
      const v = patch[key];
      if (BRIEF_JSON_FIELDS.has(key)) {
        data[key] = typeof v === "string" ? v : JSON.stringify(v ?? []);
      } else {
        data[key] = v;
      }
    }

    const [next] = await updateRows<ProjectBriefRow>(
      "ProjectBrief",
      { id: briefId },
      data,
    );
    const completion = computeCompletion(next);
    await updateRows("ProjectBrief", { id: briefId }, { completion });

    revalidatePath(`/briefs/${briefId}/builder`);
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});

// ─── Delete ──────────────────────────────────────────────────────

export const deleteBriefAction = defineAction({
  name: "brief.delete",
  input: DeleteBriefInput,
  permission: "brief.delete",
  rateLimit: { scope: "brief.delete", limit: 20, windowSec: 300 },
  handler: async ({ briefId }) => {
    await exec('DELETE FROM "ProjectBrief" WHERE "id" = $1', [briefId]);
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});

// ─── Review workflow (FormData) ──────────────────────────────────

const ReviewWorkflowInput = z.object({
  briefId: z.string().min(8),
  requiresInternalReview: z.coerce.boolean(),
  internalReviewerName: z.string().trim().optional().nullable(),
  internalReviewerEmail: z
    .string()
    .trim()
    .email("Reviewer email looks invalid")
    .optional()
    .or(z.literal(""))
    .nullable(),
  // The role select only exists in the DOM while the review toggle is on, so
  // an unchecked form posts "". Normalise that (and null) to VIEWER instead of
  // failing validation, which would block saving "no review required".
  internalReviewerRole: z
    .preprocess(
      (v) => (v === "" || v == null ? "VIEWER" : v),
      z.enum(["VIEWER", "EDITOR"]),
    )
    .optional(),
  reviewWorkflowNotes: z.string().trim().optional().nullable(),
});

const _saveBriefReviewWorkflow = defineAction({
  name: "brief.review-workflow.save",
  input: ReviewWorkflowInput,
  permission: "brief.update",
  handler: async (parsed) => {
    if (parsed.requiresInternalReview) {
      if (!parsed.internalReviewerName && !parsed.internalReviewerEmail) {
        fail({
          code: "INVALID_INPUT",
          issues: [
            {
              path: "internalReviewerEmail",
              message: "Please add the reviewer's name or email.",
            },
          ],
          message: "Please add the reviewer's name or email.",
        });
      }
    }
    await updateRows(
      "ProjectBrief",
      { id: parsed.briefId },
      {
        reviewWorkflowConfirmed: true,
        requiresInternalReview: parsed.requiresInternalReview,
        internalReviewerName: emptyToNull(parsed.internalReviewerName),
        internalReviewerEmail: emptyToNull(parsed.internalReviewerEmail),
        internalReviewerRole: emptyToNull(parsed.internalReviewerRole),
        reviewWorkflowNotes: emptyToNull(parsed.reviewWorkflowNotes),
      },
    );

    // When internal review is enabled with an email, create or update a
    // BriefCollaborator row and dispatch the invite email.
    if (parsed.requiresInternalReview && parsed.internalReviewerEmail) {
      const reviewerEmail = parsed.internalReviewerEmail.trim().toLowerCase();
      const reviewerRole = (parsed.internalReviewerRole ?? "VIEWER") as "VIEWER" | "EDITOR";
      const brief = await queryOne<{ title: string; ownerId: string }>(
        'SELECT "title", "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
        [parsed.briefId],
      );
      if (brief) {
        const { dispatchInviteEmail } = await import("@/lib/actions/collaborators");
        const crypto = await import("node:crypto");
        const owner = await queryOne<{ name: string | null }>(
          'SELECT "name" FROM "User" WHERE "id" = $1',
          [brief.ownerId],
        );

        const existing = await queryOne<{
          id: string;
          role: string;
          status: string;
          inviteToken: string;
        }>(
          `SELECT "id", "role", "status", "inviteToken"
             FROM "BriefCollaborator"
            WHERE "briefId" = $1 AND lower("email") = $2`,
          [parsed.briefId, reviewerEmail],
        );

        // Re-saving the review workflow must keep the collaborator row in sync
        // (the reviewer's role/name can change) and must re-send the invite
        // while they still haven't accepted — otherwise editing the reviewer
        // silently does nothing.
        if (existing) {
          const stillPending = existing.status === "INVITED";
          const token = existing.inviteToken;
          await updateRows(
            "BriefCollaborator",
            { id: existing.id },
            {
              name: emptyToNull(parsed.internalReviewerName),
              role: reviewerRole,
              // A row that was removed and re-invited returns to INVITED.
              status: existing.status === "REMOVED" ? "INVITED" : existing.status,
            },
          );
          if (stillPending || existing.status === "REMOVED") {
            await dispatchInviteEmail({
              toEmail: reviewerEmail,
              inviterName: owner?.name ?? "Your colleague",
              briefTitle: brief.title,
              role: reviewerRole,
              token,
              briefId: parsed.briefId,
            });
          }
        } else {
          const token = crypto.randomBytes(24).toString("hex");
          await insertRow("BriefCollaborator", {
            briefId: parsed.briefId,
            email: reviewerEmail,
            name: emptyToNull(parsed.internalReviewerName),
            role: reviewerRole,
            inviteToken: token,
            invitedById: brief.ownerId,
          });
          await dispatchInviteEmail({
            toEmail: reviewerEmail,
            inviterName: owner?.name ?? "Your colleague",
            briefTitle: brief.title,
            role: reviewerRole,
            token,
            briefId: parsed.briefId,
          });
        }
      }
    }

    revalidatePath(`/briefs/${parsed.briefId}/preview`);
    return { ok: true as const };
  },
});

export type SaveReviewWorkflowResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * `useFormState`-compatible adapter. Accepts FormData and returns the
 * legacy `{ ok, error }` shape so the existing review-workflow card
 * doesn't need refactoring.
 */
export async function saveBriefReviewWorkflowAction(
  _prev: SaveReviewWorkflowResult | undefined,
  formData: FormData,
): Promise<SaveReviewWorkflowResult> {
  const result = await _saveBriefReviewWorkflow({
    briefId: String(formData.get("briefId") ?? ""),
    requiresInternalReview: formData.get("requiresInternalReview") === "on",
    internalReviewerName: String(formData.get("internalReviewerName") ?? ""),
    internalReviewerEmail: String(formData.get("internalReviewerEmail") ?? ""),
    internalReviewerRole: String(formData.get("internalReviewerRole") ?? ""),
    reviewWorkflowNotes: String(formData.get("reviewWorkflowNotes") ?? ""),
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error.code === "INVALID_INPUT"
          ? (result.error.message ??
            result.error.issues[0]?.message ??
            "Invalid input")
          : "Could not save review workflow.",
    };
  }
  return { ok: true };
}

function emptyToNull(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

// ─── Submit ──────────────────────────────────────────────────────

/**
 * Submit a brief — move to SOURCING, optionally propose meeting slots.
 *
 * Returns `{ briefId }` so the caller can redirect to the preview page.
 */
export const submitBriefAction = defineAction({
  name: "brief.submit",
  input: SubmitBriefInput,
  output: z.object({ briefId: z.string() }),
  permission: "brief.submit",
  rateLimit: { scope: "brief.submit", limit: 10, windowSec: 600 },
  handler: async ({ briefId, meeting }, ctx) => {
    const brief = await queryOne<{
      id: string;
      title: string;
      reviewWorkflowConfirmed: boolean;
    }>(
      `SELECT "id", "title", "reviewWorkflowConfirmed"
       FROM "ProjectBrief" WHERE "id" = $1`,
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });
    if (!brief!.reviewWorkflowConfirmed) {
      fail({
        code: "CONFLICT",
        reason:
          "Please confirm your internal review & approval workflow before submitting.",
      });
    }

    const collaborators = await query<{
      role: string;
      approvedAt: Date | null;
      rejectedAt: Date | null;
      name: string | null;
      email: string;
    }>(
      `SELECT "role", "approvedAt", "rejectedAt", "name", "email"
       FROM "BriefCollaborator"
       WHERE "briefId" = $1 AND "status" <> 'REMOVED'`,
      [briefId],
    );
    const approvers = collaborators.filter((c) => c.role === "EDITOR");
    const pendingApprovers = approvers.filter((c) => !c.approvedAt && !c.rejectedAt);
    if (pendingApprovers.length > 0 || (await hasOutstandingApprovals(briefId))) {
      fail({
        code: "CONFLICT",
        reason: pendingApprovers.length > 0
          ? `Awaiting approval from ${pendingApprovers
              .map((c) => c.name ?? c.email)
              .join(", ")} before this can be sent.`
          : "Every assigned approver must sign off before partners are contacted.",
      });
    }

    // Risk Radar gate — block submit if the most recent report has a
    // `block` overall severity that the customer hasn't acknowledged.
    // Defence-in-depth: the UI also gates the button, but the server
    // is the only enforcer we trust.
    const radar = await queryOne<{
      id: string;
      overall: string;
      acknowledgedAt: Date | null;
    }>(
      `SELECT "id", "overall", "acknowledgedAt" FROM "RiskRadarReport"
       WHERE "briefId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [briefId],
    );
    if (
      radar &&
      radar.overall === "block" &&
      !radar.acknowledgedAt
    ) {
      fail({
        code: "CONFLICT",
        reason:
          "Risk Radar flagged blocking issues. Address them or acknowledge the report before submitting.",
      });
    }

    const data: Record<string, unknown> = {
      status: "ACTIVE",
      stage: "SOURCING",
      submittedAt: new Date(),
    };
    if (meeting) {
      data.meetingProposedSlots = JSON.stringify(
        meeting.proposedSlots.map((s) => ({
          startsAt: s.startsAt,
          durationMins: s.durationMins ?? 30,
        })),
      );
      if (meeting.agenda) data.meetingAgenda = meeting.agenda;
    }

    await updateRows("ProjectBrief", { id: briefId }, data);

    await insertRow("Notification", {
      userId: ctx.user!.id,
      type: "brief.submitted",
      title: "Brief sent to AI Partner",
      message: meeting
        ? "We'll confirm one of your proposed meeting times shortly."
        : "Our team is now identifying the best-fit Google Cloud partners.",
      link: `/briefs/${briefId}/preview`,
    });

    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
    );
    for (const a of admins) {
      await insertRow("Notification", {
        userId: a.id,
        type: "brief.awaiting_triage",
        title: "New brief awaiting triage",
        message: `"${brief!.title}" was submitted by the customer. Schedule the alignment meeting and start sourcing.`,
        link: `/admin/briefs/${briefId}/triage`,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath(`/briefs/${briefId}/preview`);
    return { briefId };
  },
});

// ─── Match decisions ────────────────────────────────────────────

/**
 * Customer approves a partner match proposed by the admin. Creates the
 * Proposal record, which gives the partner SoW access.
 */
export const approveMatchAction = defineAction({
  name: "match.approve",
  input: MatchActionInput,
  permission: "match.shortlist",
  rateLimit: { scope: "match.approve", limit: 30, windowSec: 60 },
  handler: async ({ matchId }) => {
    const match = await queryOne<{
      id: string;
      briefId: string;
      partnerId: string;
      briefTitle: string;
    }>(
      `SELECT m."id", m."briefId", m."partnerId", b."title" AS "briefTitle"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       WHERE m."id" = $1`,
      [matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    await updateRows("Match", { id: matchId }, { status: "REVIEW_APPROVED" });

    await insertRow(
      "Proposal",
      {
        briefId: match!.briefId,
        matchId: match!.id,
        partnerId: match!.partnerId,
        status: "DRAFT",
      },
      { onConflict: '("matchId") DO NOTHING' },
    );

    await exec(
      `UPDATE "ProjectBrief" SET "stage" = 'PROPOSALS', "updatedAt" = NOW()
       WHERE "id" = $1 AND "stage" = 'REVIEW'`,
      [match!.briefId],
    );

    const partnerUser = await queryOne<{ id: string }>(
      `SELECT "id" FROM "User"
       WHERE "companyId" = $1 AND "role" = 'PARTNER'
       LIMIT 1`,
      [match!.partnerId],
    );
    if (partnerUser) {
      await insertRow("Notification", {
        userId: partnerUser.id,
        type: "proposal.invited",
        title: "New project brief shared with you",
        message: `The customer approved the match for "${match!.briefTitle}". You can now review the SoW and draft a proposal.`,
        link: `/partner/briefs/${match!.briefId}`,
      });
    }

    revalidatePath(`/briefs/${match!.briefId}/preview`);
    revalidatePath(`/dashboard`);
    revalidatePath(`/partner`);
    return { ok: true as const };
  },
});

export const declineMatchAction = defineAction({
  name: "match.decline",
  input: MatchActionInput,
  permission: "match.decline",
  rateLimit: { scope: "match.decline", limit: 30, windowSec: 60 },
  handler: async ({ matchId }) => {
    const match = await queryOne<{ id: string; briefId: string }>(
      'SELECT "id", "briefId" FROM "Match" WHERE "id" = $1',
      [matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    await updateRows("Match", { id: matchId }, { status: "DECLINED" });
    revalidatePath(`/briefs/${match!.briefId}/preview`);
    return { ok: true as const };
  },
});

// ─── Admin stage advance ────────────────────────────────────────

export const advanceStageAction = defineAction({
  name: "brief.advance-stage",
  input: AdvanceStageInput,
  permission: "admin.triage",
  rateLimit: { scope: "brief.advance-stage", limit: 60, windowSec: 60 },
  handler: async ({ briefId, to }) => {
    await updateRows("ProjectBrief", { id: briefId }, { stage: to });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});
