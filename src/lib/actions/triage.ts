"use server";

/**
 * M4 — lead triage refit (plan-A §6 M4).
 *
 * Admin reviews a submitted lead with the company profile +
 * onboarding answers side-by-side, runs the clarification loop
 * (M9 `brief_triage` threads), and either approves the lead or
 * sends it back for clarification. All transitions run through the
 * lead state machine (audit-logged); approval also stamps the
 * admin-written anonymized company summary used for partner invites
 * (§8 Layer 2).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, updateRows, tx } from "@/lib/db";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { notify } from "@/lib/notify";

// ─── Start triage ─────────────────────────────────────────────

const StartTriageInput = z.object({ briefId: z.string().min(1) });

export const adminStartTriageAction = defineAction({
  name: "admin.triage.start",
  input: StartTriageInput,
  permission: "admin.triage",
  rateLimit: { scope: "admin.triage.start", limit: 60, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    await transitionLead({
      briefId,
      to: "IN_TRIAGE",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});

// ─── Request clarification (loop back to the company) ─────────

const RequestClarificationInput = z.object({
  briefId: z.string().min(1),
  /** The question(s) — creates a brief_triage clarification thread. */
  body: z.string().min(3).max(10_000),
  anchorSectionKey: z.string().optional(),
});

export const adminRequestClarificationAction = defineAction({
  name: "admin.triage.request-clarification",
  input: RequestClarificationInput,
  output: z.object({ threadId: z.string() }),
  permission: "admin.triage",
  rateLimit: { scope: "admin.triage.clarify", limit: 30, windowSec: 300 },
  handler: async ({ briefId, body, anchorSectionKey }, ctx) => {
    const brief = await queryOne<{
      id: string;
      title: string;
      ownerId: string;
    }>(
      'SELECT "id", "title", "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Ensure the lead sits in triage before looping back.
    const state = await getLeadState(briefId);
    if (state === "SUBMITTED") {
      await transitionLead({
        briefId,
        to: "IN_TRIAGE",
        actor: userActor(ctx.user!.id, ctx.user!.companyId),
      });
    }

    const thread = await tx(async (client) => {
      const t = await insertRow<{ id: string }>(
        "ClarificationThread",
        {
          contextType: "brief_triage",
          briefId,
          anchorSectionKey: anchorSectionKey ?? null,
          status: "awaiting_company",
          createdById: ctx.user!.id,
        },
        { client },
      );
      await insertRow(
        "ClarificationMessage",
        {
          threadId: t.id,
          authorId: ctx.user!.id,
          authorRole: "admin",
          kind: "text",
          body,
        },
        { client },
      );
      return t;
    });

    await transitionLead({
      briefId,
      to: "CLARIFICATION_NEEDED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      meta: { threadId: thread.id },
    });

    await notify({
      event: "clarification.new_message",
      recipients: [{ userId: brief!.ownerId }],
      vars: {
        briefTitle: brief!.title,
        fromLabel: "The AIPartner team",
        preview: body.slice(0, 300),
      },
      link: `/briefs/${briefId}/clarifications`,
      briefId,
      idemKey: `triage-clarify:${thread.id}`,
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    return { threadId: thread.id };
  },
});

// ─── Resume triage after answers ──────────────────────────────

const ResumeTriageInput = z.object({ briefId: z.string().min(1) });

export const adminResumeTriageAction = defineAction({
  name: "admin.triage.resume",
  input: ResumeTriageInput,
  permission: "admin.triage",
  rateLimit: { scope: "admin.triage.resume", limit: 60, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    await transitionLead({
      briefId,
      to: "IN_TRIAGE",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});

// ─── Approve lead ─────────────────────────────────────────────

const ApproveLeadInput = z.object({
  briefId: z.string().min(1),
  /**
   * Admin-written anonymized company summary — the ONLY company
   * description partners see pre-reveal (§8 L2). E.g. "Mid-size
   * manufacturing company, ~2,000 employees, data team of 6".
   */
  anonymizedCompanySummary: z.string().min(20).max(2000),
});

export const adminApproveLeadAction = defineAction({
  name: "admin.triage.approve",
  input: ApproveLeadInput,
  permission: "admin.triage",
  rateLimit: { scope: "admin.triage.approve", limit: 30, windowSec: 60 },
  handler: async ({ briefId, anonymizedCompanySummary }, ctx) => {
    const brief = await queryOne<{ id: string; companyName: string }>(
      `SELECT b."id", c."name" AS "companyName"
       FROM "ProjectBrief" b
       JOIN "Company" c ON c."id" = b."companyId"
       WHERE b."id" = $1`,
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Layer-2 lint: the summary must not contain the company name.
    const summary = anonymizedCompanySummary.trim();
    const companyName = brief!.companyName.trim();
    if (
      companyName.length > 2 &&
      summary.toLowerCase().includes(companyName.toLowerCase())
    ) {
      fail({
        code: "CONFLICT",
        reason:
          "The anonymized summary contains the company name — rewrite it without identifying details.",
      });
    }

    await updateRows(
      "ProjectBrief",
      { id: briefId },
      { anonymizedCompanySummary: summary },
    );
    await transitionLead({
      briefId,
      to: "LEAD_APPROVED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath("/admin/briefs");
    return { ok: true as const };
  },
});
