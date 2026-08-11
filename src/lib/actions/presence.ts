"use server";

/**
 * Brief presence — who's currently looking at this brief.
 *
 * The client heartbeats `markPresenceAction` every ~10s; the server
 * upserts the row's `lastSeenAt`. The reader (`listPresenceForBrief`)
 * surfaces anyone whose `lastSeenAt > now - 30s` as "active right now".
 *
 * **No realtime sockets.** Polling is enough for the design goals and
 * cheap to operate. If the polling rate becomes a problem we'd swap
 * to Supabase Realtime — the schema doesn't need to change.
 *
 * Privacy: presence is intentionally limited to users who already have
 * brief access (owner / collaborator / admin). No partner sees the
 * customer's presence — the partner brief view never invokes this.
 */

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow } from "@/lib/db";

const ACTIVITY = z.enum(["viewing", "editing", "commenting"]);

const MarkPresenceInput = z.object({
  briefId: z.string().min(1),
  activity: ACTIVITY.optional().default("viewing"),
});

/** Upsert the (briefId, userId) presence row. Idempotent; safe to call
 *  many times per minute. */
export const markPresenceAction = defineAction({
  name: "presence.mark",
  input: MarkPresenceInput,
  // Skip the audit log — presence is too chatty to record.
  skipAudit: true,
  permission: "comment.create",
  rateLimit: { scope: "presence.mark", limit: 60, windowSec: 60 },
  handler: async ({ briefId, activity }, ctx) => {
    const brief = await queryOne<{ ownerId: string }>(
      'SELECT "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    const isOwner = brief!.ownerId === ctx.user!.id;
    const isAdmin = ctx.user!.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      const seat = await queryOne<{ id: string }>(
        `SELECT "id" FROM "BriefCollaborator"
         WHERE "briefId" = $1 AND ("userId" = $2 OR "email" = $3)
           AND "status" <> 'REMOVED'
         LIMIT 1`,
        [briefId, ctx.user!.id, ctx.user!.email.toLowerCase()],
      );
      if (!seat) fail({ code: "FORBIDDEN" });
    }

    await insertRow(
      "BriefPresence",
      {
        briefId,
        userId: ctx.user!.id,
        activity,
        lastSeenAt: new Date(),
      },
      {
        onConflict: `("briefId", "userId") DO UPDATE SET
          "activity" = EXCLUDED."activity",
          "lastSeenAt" = EXCLUDED."lastSeenAt"`,
      },
    );

    return { ok: true as const };
  },
});

/** Server-side reader — returns users whose heartbeat is recent. */
export async function listPresenceForBrief(
  briefId: string,
  options: { windowSec?: number } = {},
) {
  const cutoff = new Date(Date.now() - (options.windowSec ?? 30) * 1000);
  const rows = await query<{
    id: string;
    briefId: string;
    userId: string;
    activity: string;
    lastSeenAt: Date;
    userName: string | null;
    userEmail: string;
  }>(
    `SELECT p.*, u."name" AS "userName", u."email" AS "userEmail"
     FROM "BriefPresence" p
     JOIN "User" u ON u."id" = p."userId"
     WHERE p."briefId" = $1 AND p."lastSeenAt" > $2
     ORDER BY p."lastSeenAt" DESC LIMIT 12`,
    [briefId, cutoff],
  );
  return rows.map((r) => ({
    id: r.id,
    briefId: r.briefId,
    userId: r.userId,
    activity: r.activity,
    lastSeenAt: r.lastSeenAt,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}
