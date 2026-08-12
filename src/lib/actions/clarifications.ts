"use server";

/**
 * M9 — unified clarification threads (plan-A §6 M9).
 *
 * One mechanism, three contexts:
 *   - `brief_triage`      admin ↔ company during lead review (M4.3)
 *   - `proposal_qc`       admin ↔ partner during proposal QC (M8.2)
 *   - `partner_question`  partner ↔ company via ADMIN-MEDIATED relay —
 *                         the firewall holds: identities stay hidden,
 *                         messages render as "Partner A asked…".
 *
 * Every thread supports async messages AND a "book a call" escalation
 * (slot proposal → confirmation). Resolution is recorded as
 * message-based or call-based. All writes are audit-logged via
 * defineAction.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, tx } from "@/lib/db";
import { notify, notifyAdmins } from "@/lib/notify";

const CONTEXT_TYPES = [
  "brief_triage",
  "proposal_qc",
  "partner_question",
  // Customer → a specific anonymized partner, about their proposal,
  // BEFORE selection. Previously the customer could only compare on
  // what was written and had no way to ask a follow-up without
  // breaking anonymity.
  "proposal_question",
] as const;

function audienceOf(role: string): "company" | "partner" | "admin" {
  if (role === "ADMIN") return "admin";
  if (role === "PARTNER") return "partner";
  return "company";
}

/** Status after a message from `audience` — the ball moves to the other side. */
function nextStatus(
  contextType: string,
  audience: "company" | "partner" | "admin",
): string {
  switch (contextType) {
    case "brief_triage":
      return audience === "company" ? "awaiting_admin" : "awaiting_company";
    case "proposal_qc":
      return audience === "partner" ? "awaiting_admin" : "awaiting_partner";
    case "partner_question":
      // Admin-mediated: company answers → admin relays; partner asks → company answers.
      return audience === "company"
        ? "awaiting_partner"
        : audience === "partner"
          ? "awaiting_company"
          : "open";
    case "proposal_question":
      // Mirror image of partner_question: the customer asks, the
      // partner answers, both sides stay anonymous throughout.
      return audience === "company" ? "awaiting_partner" : "awaiting_company";
    default:
      return "open";
  }
}

/** Fan out the "new message" notification to the correct side. */
async function notifyThreadCounterparty(opts: {
  threadId: string;
  contextType: string;
  briefId: string;
  matchId: string | null;
  authorAudience: "company" | "partner" | "admin";
  preview: string;
}) {
  const brief = await queryOne<{
    id: string;
    title: string;
    ownerId: string;
    companyId: string;
  }>(
    'SELECT "id", "title", "ownerId", "companyId" FROM "ProjectBrief" WHERE "id" = $1',
    [opts.briefId],
  );
  if (!brief) return;

  const partnerUsers = opts.matchId
    ? await query<{ id: string }>(
        `SELECT u."id" FROM "User" u
         JOIN "Match" m ON m."partnerId" = u."companyId"
         WHERE m."id" = $1 AND u."role" = 'PARTNER'`,
        [opts.matchId],
      )
    : [];

  // Firewall-safe from-labels: never a company or partner name.
  const fromLabel =
    opts.authorAudience === "admin"
      ? "The AIPartner team"
      : opts.authorAudience === "partner"
        ? "A matched partner"
        : "The customer";

  const base = {
    event: "clarification.new_message" as const,
    vars: {
      briefTitle: brief.title,
      fromLabel,
      preview: opts.preview.slice(0, 300),
    },
    briefId: brief.id,
    matchId: opts.matchId ?? undefined,
    idemKey: `${opts.threadId}:${Date.now()}`,
  };

  switch (opts.contextType) {
    case "brief_triage":
      if (opts.authorAudience === "company") {
        await notifyAdmins({ ...base, link: `/admin/briefs/${brief.id}` });
      } else {
        await notify({
          ...base,
          recipients: [{ userId: brief.ownerId }],
          link: `/briefs/${brief.id}/clarifications`,
        });
      }
      return;
    case "proposal_qc":
      if (opts.authorAudience === "partner") {
        await notifyAdmins({ ...base, link: `/admin/briefs/${brief.id}` });
      } else {
        await notify({
          ...base,
          recipients: partnerUsers.map((u) => ({ userId: u.id })),
          link: `/partner/briefs/${brief.id}`,
        });
      }
      return;
    case "partner_question":
    case "proposal_question":
      if (opts.authorAudience === "partner") {
        // Partner asked → company answers (anonymized label).
        await notify({
          ...base,
          recipients: [{ userId: brief.ownerId }],
          link: `/briefs/${brief.id}/clarifications`,
        });
      } else if (opts.authorAudience === "company") {
        await notify({
          ...base,
          recipients: partnerUsers.map((u) => ({ userId: u.id })),
          link: `/partner/briefs/${brief.id}`,
        });
      }
      // Admins always observe.
      await notifyAdmins({ ...base, link: `/admin/briefs/${brief.id}` });
      return;
  }
}

// ─── Create thread ────────────────────────────────────────────

const CreateThreadInput = z.object({
  briefId: z.string().min(1),
  contextType: z.enum(CONTEXT_TYPES),
  matchId: z.string().optional(),
  proposalId: z.string().optional(),
  anchorSectionKey: z.string().optional(),
  body: z.string().min(1).max(10_000),
});

export const createClarificationThreadAction = defineAction({
  name: "clarification.create",
  input: CreateThreadInput,
  output: z.object({ threadId: z.string() }),
  permission: "clarification.create",
  rateLimit: { scope: "clarification.create", limit: 20, windowSec: 300 },
  handler: async (data, ctx) => {
    const audience = audienceOf(ctx.user!.role);

    // partner_question / proposal_qc need the match context.
    if (data.contextType !== "brief_triage" && !data.matchId) {
      fail({ code: "CONFLICT", reason: "matchId required for this context" });
    }

    const thread = await tx(async (client) => {
      const t = await insertRow<{ id: string }>(
        "ClarificationThread",
        {
          contextType: data.contextType,
          briefId: data.briefId,
          matchId: data.matchId ?? null,
          proposalId: data.proposalId ?? null,
          anchorSectionKey: data.anchorSectionKey ?? null,
          status: nextStatus(data.contextType, audience),
          createdById: ctx.user!.id,
        },
        { client },
      );
      await insertRow(
        "ClarificationMessage",
        {
          threadId: t.id,
          authorId: ctx.user!.id,
          authorRole: audience,
          kind: "text",
          body: data.body,
        },
        { client },
      );
      return t;
    });

    await notifyThreadCounterparty({
      threadId: thread.id,
      contextType: data.contextType,
      briefId: data.briefId,
      matchId: data.matchId ?? null,
      authorAudience: audience,
      preview: data.body,
    });

    revalidatePath(`/briefs/${data.briefId}/clarifications`);
    revalidatePath(`/admin/briefs/${data.briefId}`);
    return { threadId: thread.id };
  },
});

// ─── Reply (text or call proposal/confirmation) ───────────────

const ReplyInput = z.object({
  threadId: z.string().min(1),
  briefId: z.string().min(1), // for RBAC conditions
  matchId: z.string().optional(),
  kind: z.enum(["text", "call_proposal", "call_confirmed"]).default("text"),
  body: z.string().min(1).max(10_000),
  /** For call_proposal: proposed slots. */
  slots: z
    .array(z.object({ startsAt: z.string(), durationMins: z.number().int() }))
    .max(10)
    .default([]),
  /** For call_confirmed: the chosen slot ISO timestamp. */
  chosenSlot: z.string().optional(),
});

export const replyClarificationAction = defineAction({
  name: "clarification.reply",
  input: ReplyInput,
  permission: "clarification.reply",
  rateLimit: { scope: "clarification.reply", limit: 60, windowSec: 300 },
  handler: async (data, ctx) => {
    const thread = await queryOne<{
      id: string;
      contextType: string;
      briefId: string;
      matchId: string | null;
      status: string;
    }>(
      `SELECT "id", "contextType", "briefId", "matchId", "status"
       FROM "ClarificationThread" WHERE "id" = $1`,
      [data.threadId],
    );
    if (!thread) fail({ code: "NOT_FOUND", resource: "ClarificationThread" });
    if (thread!.status === "resolved") {
      fail({ code: "CONFLICT", reason: "Thread is resolved" });
    }

    const audience = audienceOf(ctx.user!.role);

    await tx(async (client) => {
      await insertRow(
        "ClarificationMessage",
        {
          threadId: thread!.id,
          authorId: ctx.user!.id,
          authorRole: audience,
          kind: data.kind,
          body: data.body,
          slots: JSON.stringify(data.slots),
          chosenSlot: data.chosenSlot ?? null,
        },
        { client },
      );
      await client.query(
        `UPDATE "ClarificationThread" SET "status" = $2, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [thread!.id, nextStatus(thread!.contextType, audience)],
      );
    });

    await notifyThreadCounterparty({
      threadId: thread!.id,
      contextType: thread!.contextType,
      briefId: thread!.briefId,
      matchId: thread!.matchId,
      authorAudience: audience,
      preview:
        data.kind === "call_proposal"
          ? `${data.body}\n(Proposed ${data.slots.length} call slot${data.slots.length === 1 ? "" : "s"})`
          : data.body,
    });

    revalidatePath(`/briefs/${thread!.briefId}/clarifications`);
    revalidatePath(`/admin/briefs/${thread!.briefId}`);
    return { ok: true as const };
  },
});

// ─── Resolve ──────────────────────────────────────────────────

const ResolveInput = z.object({
  threadId: z.string().min(1),
  briefId: z.string().min(1), // for RBAC conditions
  resolution: z.enum(["message", "call"]),
});

export const resolveClarificationAction = defineAction({
  name: "clarification.resolve",
  input: ResolveInput,
  permission: "clarification.resolve",
  rateLimit: { scope: "clarification.resolve", limit: 30, windowSec: 300 },
  handler: async ({ threadId, resolution }) => {
    const thread = await queryOne<{
      id: string;
      briefId: string;
      status: string;
    }>(
      'SELECT "id", "briefId", "status" FROM "ClarificationThread" WHERE "id" = $1',
      [threadId],
    );
    if (!thread) fail({ code: "NOT_FOUND", resource: "ClarificationThread" });
    if (thread!.status === "resolved") return { ok: true as const };

    await queryOne(
      `UPDATE "ClarificationThread"
       SET "status" = 'resolved', "resolution" = $2, "resolvedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      [threadId, resolution],
    );

    revalidatePath(`/briefs/${thread!.briefId}/clarifications`);
    revalidatePath(`/admin/briefs/${thread!.briefId}`);
    return { ok: true as const };
  },
});
