"use server";

/**
 * M11 — post-selection: meetings-scheduled transition, meeting
 * summaries to the customer, and deal reporting (plan-A §6 M11).
 *
 * Deal reporting is the platform's revenue signal (10% fee note in
 * §3.2 step 15): partners self-report, admins can report on their
 * behalf, and outcomes drive the terminal lead states.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, tx } from "@/lib/db";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { notifyAdmins, notifyCompanyUsers } from "@/lib/notify";

// ─── Meetings scheduled (lead transition) ─────────────────────

const MeetingsScheduledInput = z.object({ briefId: z.string().min(1) });

export const adminMarkMeetingsScheduledAction = defineAction({
  name: "admin.meetings.scheduled",
  input: MeetingsScheduledInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.meetings.scheduled", limit: 30, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    await transitionLead({
      briefId,
      to: "MEETINGS_SCHEDULED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});

// ─── Meeting summaries to the customer (M11.4, P1-light) ──────

const SendSummariesInput = z.object({
  briefId: z.string().min(1),
  summary: z.string().min(20).max(50_000),
});

export const adminSendMeetingSummariesAction = defineAction({
  name: "admin.meetings.summaries",
  input: SendSummariesInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.meetings.summaries", limit: 10, windowSec: 300 },
  handler: async ({ briefId, summary }, ctx) => {
    const brief = await queryOne<{
      id: string;
      title: string;
      companyId: string;
    }>(
      'SELECT "id", "title", "companyId" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Persist as an admin-authored clarification thread so the
    // customer can respond in place (and it's audit-trailed).
    await tx(async (client) => {
      const thread = await insertRow<{ id: string }>(
        "ClarificationThread",
        {
          contextType: "brief_triage",
          briefId,
          status: "awaiting_company",
          createdById: ctx.user!.id,
        },
        { client },
      );
      await insertRow(
        "ClarificationMessage",
        {
          threadId: thread.id,
          authorId: ctx.user!.id,
          authorRole: "admin",
          kind: "text",
          body: `Meeting summaries:\n\n${summary}`,
        },
        { client },
      );
    });

    await notifyCompanyUsers(brief!.companyId, {
      event: "meeting.summaries_ready",
      vars: { briefTitle: brief!.title },
      link: `/briefs/${briefId}/clarifications`,
      briefId,
      idemKey: `summaries:${briefId}:${Date.now()}`,
    });

    revalidatePath(`/briefs/${briefId}/clarifications`);
    return { ok: true as const };
  },
});

// ─── Deal reporting ───────────────────────────────────────────

const OUTCOMES = ["deal", "no_deal", "nda_signed", "dropped_off"] as const;

const ReportDealInput = z.object({
  briefId: z.string().min(1),
  matchId: z.string().min(1),
  outcome: z.enum(OUTCOMES),
  contractValueCents: z.coerce.number().int().nonnegative().optional(),
  monthlyVolumeCents: z.coerce.number().int().nonnegative().optional(),
  startDate: z.string().optional(), // ISO date
  durationMonths: z.coerce.number().int().min(1).max(120).optional(),
  notes: z.string().max(5000).optional(),
});

async function persistDealReport(
  data: z.infer<typeof ReportDealInput>,
  source: "partner_self" | "admin",
  reporterId: string,
) {
  return insertRow("DealReport", {
    briefId: data.briefId,
    matchId: data.matchId,
    reportedById: reporterId,
    source,
    outcome: data.outcome,
    contractValueCents:
      data.contractValueCents != null
        ? BigInt(data.contractValueCents).toString()
        : null,
    monthlyVolumeCents:
      data.monthlyVolumeCents != null
        ? BigInt(data.monthlyVolumeCents).toString()
        : null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    durationMonths: data.durationMonths ?? null,
    notes: data.notes ?? null,
  });
}

export const partnerReportDealAction = defineAction({
  name: "deal.report",
  input: ReportDealInput,
  permission: "deal.report",
  rateLimit: { scope: "deal.report", limit: 10, windowSec: 300 },
  handler: async (data, ctx) => {
    const match = await queryOne<{
      id: string;
      partnerId: string;
      status: string;
      briefTitle: string;
      partnerName: string;
    }>(
      `SELECT m."id", m."partnerId", m."status",
              b."title" AS "briefTitle", c."name" AS "partnerName"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       JOIN "Company" c ON c."id" = m."partnerId"
       WHERE m."id" = $1`,
      [data.matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
    if (match!.partnerId !== ctx.user!.companyId) {
      fail({ code: "FORBIDDEN", reason: "Not your match" });
    }
    if (match!.status !== "SELECTED") {
      fail({ code: "CONFLICT", reason: "Deal reporting requires a selected match" });
    }

    await persistDealReport(data, "partner_self", ctx.user!.id);

    await notifyAdmins({
      event: "clarification.new_message",
      vars: {
        briefTitle: match!.briefTitle,
        fromLabel: match!.partnerName,
        preview: `Deal report: ${data.outcome}${
          data.contractValueCents
            ? ` — €${(data.contractValueCents / 100).toLocaleString()}`
            : ""
        }${data.notes ? `\n${data.notes.slice(0, 200)}` : ""}`,
      },
      link: `/admin/briefs/${data.briefId}`,
      briefId: data.briefId,
      matchId: data.matchId,
      idemKey: `deal:${data.matchId}:${Date.now()}`,
    });

    revalidatePath(`/partner/briefs/${data.briefId}`);
    return { ok: true as const };
  },
});

export const adminReportDealAction = defineAction({
  name: "admin.deal.report",
  input: ReportDealInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.deal.report", limit: 30, windowSec: 300 },
  handler: async (data, ctx) => {
    await persistDealReport(data, "admin", ctx.user!.id);

    // Admin reports drive the terminal lead state.
    const state = await getLeadState(data.briefId);
    if (state === "MEETINGS_SCHEDULED" || state === "DROPPED_OFF") {
      if (data.outcome === "deal") {
        await transitionLead({
          briefId: data.briefId,
          to: "COMPLETED",
          actor: userActor(ctx.user!.id, ctx.user!.companyId),
          reason: "Deal reported",
        });
      } else if (data.outcome === "dropped_off" && state === "MEETINGS_SCHEDULED") {
        await transitionLead({
          briefId: data.briefId,
          to: "DROPPED_OFF",
          actor: userActor(ctx.user!.id, ctx.user!.companyId),
          reason: "Customer dropped off",
        });
      }
    }

    revalidatePath(`/admin/briefs/${data.briefId}`);
    return { ok: true as const };
  },
});
