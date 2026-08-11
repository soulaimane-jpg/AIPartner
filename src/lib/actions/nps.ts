"use server";

/**
 * NPS / CSAT capture.
 *
 * One Server Action: `submitNpsResponseAction`. The caller (a
 * client component shown after a key milestone — partner picked,
 * partner introduction completed, etc.) submits a 0-10 score, an
 * optional comment, and the surface that prompted them.
 *
 * The score → category mapping is deliberately here (not in the DB
 * trigger), so a future re-bucketing (e.g. 0-5 detractor) is one
 * code change with a migration script.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow } from "@/lib/db";

const NpsSurface = z.enum([
  "customer.intro",
  "customer.proposal-picked",
  "partner.engagement",
  "googler.referral-closed",
]);

const SubmitNpsInput = z.object({
  score: z.coerce.number().int().min(0).max(10),
  surface: NpsSurface,
  briefId: z.string().min(1).optional(),
  comment: z.string().max(2000).optional(),
});

function bucketNps(score: number): "detractor" | "passive" | "promoter" {
  if (score <= 6) return "detractor";
  if (score <= 8) return "passive";
  return "promoter";
}

export const submitNpsResponseAction = defineAction({
  name: "nps.submit",
  input: SubmitNpsInput,
  output: z.object({ id: z.string() }),
  permission: "tenant.read",
  rateLimit: { scope: "nps.submit", limit: 10, windowSec: 3600 },
  handler: async ({ score, surface, briefId, comment }, ctx) => {
    if (briefId) {
      // Only allow attaching to a brief the user actually has access to.
      const brief = await queryOne<{ id: string }>(
        'SELECT "id" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
        [briefId, ctx.user!.id],
      );
      if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });
    }

    const row = await insertRow<{ id: string }>("NpsResponse", {
      userId: ctx.user!.id,
      briefId: briefId ?? null,
      score,
      category: bucketNps(score),
      surface,
      comment: comment?.trim() || null,
    });

    if (briefId) revalidatePath(`/briefs/${briefId}/preview`);
    return { id: row.id };
  },
});
