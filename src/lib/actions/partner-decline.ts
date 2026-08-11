"use server";

/**
 * Partner declines a match with a structured reason.
 *
 * Why structured: a raw free-text decline kills the analytics feedback
 * loop. Forcing a closed taxonomy ("no-bandwidth", "no-fit-vertical"
 * …) means we can tell admins *why* a partner roster keeps passing on
 * BigQuery briefs, and feed that into the matching algorithm later.
 *
 * The optional `freeText` is preserved verbatim on `Match.declineNote`
 * for context but never short-circuits the taxonomy.
 *
 * Notifies the admin team so they can re-route the brief.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import {
  DECLINE_REASONS,
  DECLINE_REASON_LABELS,
} from "@/lib/schemas/decline-reasons";

const DeclineWithReasonInput = z.object({
  matchId: z.string().min(1),
  reason: z.enum(DECLINE_REASONS),
  freeText: z.string().trim().max(2000).optional(),
});

export const declineMatchWithReasonAction = defineAction({
  name: "partner.match.decline",
  input: DeclineWithReasonInput,
  permission: "match.decline",
  rateLimit: { scope: "partner.match.decline", limit: 30, windowSec: 60 },
  handler: async ({ matchId, reason, freeText }, ctx) => {
    const match = await queryOne<{
      id: string;
      partnerId: string;
      briefId: string;
      briefTitle: string;
    }>(
      `SELECT m."id", m."partnerId", m."briefId", b."title" AS "briefTitle"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       WHERE m."id" = $1`,
      [matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    // Authorisation: the caller must belong to the partner Company on
    // this match.
    if (match!.partnerId !== ctx.user!.companyId) {
      fail({
        code: "FORBIDDEN",
        reason: "This match isn't assigned to your company.",
      });
    }

    // 'other' requires a free-text — keeps the taxonomy honest.
    if (reason === "other" && !freeText) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "freeText",
            message: "Tell us briefly why — 'Other' needs a note.",
          },
        ],
      });
    }

    await updateRows(
      "Match",
      { id: matchId },
      {
        status: "PARTNER_DECLINED",
        declineReason: reason,
        declineNote: freeText ?? null,
      },
    );

    // Notify all admins so they can re-route the brief.
    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
    );
    for (const a of admins) {
      await insertRow("Notification", {
        userId: a.id,
        type: "partner.declined",
        title: `${ctx.user!.name ?? "A partner"} declined a lead`,
        message: `${DECLINE_REASON_LABELS[reason]}${
          freeText ? ` — ${freeText.slice(0, 160)}` : ""
        } · "${match!.briefTitle}"`,
        link: `/admin/briefs/${match!.briefId}`,
      });
    }

    revalidatePath("/partner");
    revalidatePath(`/admin/briefs/${match!.briefId}`);
    return { ok: true as const };
  },
});
