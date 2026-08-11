/**
 * Brief Q&A round — anonymous questions from partners to customers.
 *
 * Flow:
 *   1. Partner asks a question via `askQuestion`. The row lands in
 *      `pending` state. We fan-out a `qa.asked` webhook to the
 *      customer's company so their integrations can route the
 *      notification.
 *   2. Customer answers via `answerQuestion`. Status → `answered`,
 *      answer text persisted, `qa.answered` event dispatched.
 *   3. Either side can withdraw via `withdrawQuestion`.
 *   4. Admin can reject inappropriate questions via `rejectQuestion`
 *      (carries a reason for the asker's audit trail).
 *
 * Anonymity contract:
 *   - The customer never sees the partner's name. The `BriefQaQuestion`
 *     row stores `askedById` for audit but UI reads strip it.
 *   - The partner never sees the customer's name either — they see the
 *     anonymised profile that was attached to the brief at intake.
 */

"use server";

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";

const MAX_QUESTION_LEN = 1_000;
const MAX_ANSWER_LEN = 4_000;

export const askQuestion = defineAction({
  name: "qa.ask",
  permission: "qa.ask",
  rateLimit: { scope: "qa.ask", limit: 20, windowSec: 600 },
  input: z.object({
    briefId: z.string().min(1),
    question: z.string().trim().min(8).max(MAX_QUESTION_LEN),
    visibility: z.enum(["all-partners", "asker-only"]).default("all-partners"),
  }),
  output: z.object({ id: z.string() }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    if (!ctx.user.companyId) {
      throw fail({ code: "FORBIDDEN", reason: "no-company" });
    }

    // Confirm the brief exists + grab the owning company for routing.
    const brief = await queryOne<{ id: string; companyId: string }>(
      'SELECT "id", "companyId" FROM "ProjectBrief" WHERE "id" = $1',
      [input.briefId],
    );
    if (!brief) throw fail({ code: "NOT_FOUND" });

    const row = await insertRow<{ id: string }>("BriefQaQuestion", {
      briefId: brief.id,
      askedById: ctx.user.id,
      askedByCompanyId: ctx.user.companyId,
      question: input.question,
      // No moderation pass today — public == raw. Hook a sanitiser
      // here when we wire moderation in a follow-up.
      questionPublic: input.question,
      visibility: input.visibility,
      status: "pending",
    });

    // Fire-and-forget — never block the user on outbound webhooks.
    void dispatchWebhook(
      "qa.asked",
      {
        briefId: brief.id,
        questionId: row.id,
        visibility: input.visibility,
      },
      { companyIds: [brief.companyId], requestId: ctx.requestId },
    );

    revalidatePath(`/briefs/${brief.id}`);
    revalidatePath(`/partner/briefs/${brief.id}`);
    return { id: row.id };
  },
});

export const answerQuestion = defineAction({
  name: "qa.answer",
  permission: "qa.answer",
  rateLimit: { scope: "qa.answer", limit: 60, windowSec: 600 },
  input: z.object({
    briefId: z.string().min(1),
    questionId: z.string().min(1),
    answer: z.string().trim().min(1).max(MAX_ANSWER_LEN),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const q = await queryOne<{
      briefId: string;
      askedByCompanyId: string;
      status: string;
    }>(
      'SELECT "briefId", "askedByCompanyId", "status" FROM "BriefQaQuestion" WHERE "id" = $1',
      [input.questionId],
    );
    if (!q || q.briefId !== input.briefId) {
      throw fail({ code: "NOT_FOUND" });
    }
    if (q.status === "answered") {
      throw fail({ code: "CONFLICT", reason: "already-answered" });
    }
    if (q.status === "withdrawn" || q.status === "rejected") {
      throw fail({ code: "CONFLICT", reason: q.status });
    }

    await updateRows(
      "BriefQaQuestion",
      { id: input.questionId },
      {
        answer: input.answer,
        answeredById: ctx.user.id,
        answeredAt: new Date(),
        status: "answered",
      },
    );

    void dispatchWebhook(
      "qa.answered",
      { briefId: input.briefId, questionId: input.questionId },
      { companyIds: [q.askedByCompanyId], requestId: ctx.requestId },
    );

    revalidatePath(`/briefs/${input.briefId}`);
    revalidatePath(`/partner/briefs/${input.briefId}`);
    return { ok: true as const };
  },
});

export const withdrawQuestion = defineAction({
  name: "qa.withdraw",
  permission: "qa.ask",
  rateLimit: { scope: "qa.withdraw", limit: 30, windowSec: 600 },
  input: z.object({
    briefId: z.string().min(1),
    questionId: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const q = await queryOne<{
      briefId: string;
      askedById: string;
      status: string;
    }>(
      'SELECT "briefId", "askedById", "status" FROM "BriefQaQuestion" WHERE "id" = $1',
      [input.questionId],
    );
    if (!q || q.briefId !== input.briefId) {
      throw fail({ code: "NOT_FOUND" });
    }
    // Only the asker can withdraw (admin uses `rejectQuestion`).
    if (q.askedById !== ctx.user.id) {
      throw fail({ code: "FORBIDDEN", reason: "not-asker" });
    }
    if (q.status === "withdrawn") return { ok: true as const };

    await updateRows(
      "BriefQaQuestion",
      { id: input.questionId },
      { status: "withdrawn" },
    );
    revalidatePath(`/partner/briefs/${input.briefId}`);
    return { ok: true as const };
  },
});

/**
 * Server-side reader for the customer's brief detail page. Strips
 * partner identity. `briefOwnerId` should be checked by the caller.
 */
export async function listQaQuestionsForCustomer(briefId: string) {
  return query<{
    id: string;
    questionPublic: string;
    answer: string | null;
    status: string;
    visibility: string;
    createdAt: Date;
    answeredAt: Date | null;
  }>(
    `SELECT "id", "questionPublic", "answer", "status", "visibility",
            "createdAt", "answeredAt"
     FROM "BriefQaQuestion"
     WHERE "briefId" = $1 AND "status" IN ('pending', 'answered')
     ORDER BY "createdAt" ASC`,
    [briefId],
  );
}

/**
 * Reader for the partner side: shows public Q&A on the brief plus
 * any questions THIS partner has asked privately ("asker-only").
 */
export async function listQaQuestionsForPartner(
  briefId: string,
  partnerCompanyId: string,
) {
  const rows = await query<{
    id: string;
    questionPublic: string;
    answer: string | null;
    status: string;
    visibility: string;
    createdAt: Date;
    answeredAt: Date | null;
    askedByCompanyId: string;
  }>(
    `SELECT "id", "questionPublic", "answer", "status", "visibility",
            "createdAt", "answeredAt", "askedByCompanyId"
     FROM "BriefQaQuestion"
     WHERE "briefId" = $1 AND "status" IN ('pending', 'answered')
       AND ("visibility" = 'all-partners'
            OR ("visibility" = 'asker-only' AND "askedByCompanyId" = $2))
     ORDER BY "createdAt" ASC`,
    [briefId, partnerCompanyId],
  );

  return rows.map((r) => ({
    ...r,
    mine: r.askedByCompanyId === partnerCompanyId,
    // Don't leak the asker company id outside the "is this mine?" bit.
    askedByCompanyId: undefined,
  }));
}
