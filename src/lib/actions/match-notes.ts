"use server";

/**
 * Match notes — partner-side CRM-lite per-Match annotations.
 *
 * **Visibility:** only users who belong to the partner Company on the
 * Match see/edit notes. Customer + admin never see them. The note
 * body is never copied into outreach or proposals.
 *
 * Tags are a small free-form JSON array (e.g. ["warm", "exec-meet"]).
 * If/when the partner population gets big enough to need cross-record
 * filtering, we'll promote tags to their own table; until then a JSON
 * column is the right call.
 *
 * `remindAt` surfaces the note in the partner digest on/after that
 * date. The digest worker clears `remindAt` on send.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";

async function assertMatchAccess(matchId: string, companyId: string | null) {
  if (!companyId) fail({ code: "FORBIDDEN" });
  const match = await queryOne<{ id: string; partnerId: string }>(
    'SELECT "id", "partnerId" FROM "Match" WHERE "id" = $1',
    [matchId],
  );
  if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
  if (match!.partnerId !== companyId) {
    fail({ code: "FORBIDDEN", reason: "Not your match." });
  }
}

// ─── Create / update ─────────────────────────────────────────────

const UpsertMatchNoteInput = z.object({
  id: z.string().optional(),
  matchId: z.string().min(1),
  body: z.string().trim().min(1).max(8000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  remindAt: z
    .union([z.string().datetime(), z.literal("")])
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

export const upsertMatchNoteAction = defineAction({
  name: "partner.match-note.upsert",
  input: UpsertMatchNoteInput,
  output: z.object({ id: z.string() }),
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.match-note.upsert", limit: 60, windowSec: 60 },
  handler: async ({ id, matchId, body, tags, remindAt }, ctx) => {
    await assertMatchAccess(matchId, ctx.user!.companyId ?? null);

    if (id) {
      const existing = await queryOne<{
        id: string;
        matchId: string;
        authorId: string;
      }>(
        'SELECT "id", "matchId", "authorId" FROM "MatchNote" WHERE "id" = $1',
        [id],
      );
      if (!existing) fail({ code: "NOT_FOUND", resource: "MatchNote" });
      if (existing!.matchId !== matchId) {
        fail({ code: "FORBIDDEN" });
      }
      const [row] = await updateRows<{ id: string }>(
        "MatchNote",
        { id },
        {
          body,
          tags: JSON.stringify(tags),
          remindAt: remindAt ?? null,
        },
      );
      revalidatePath("/partner");
      return { id: row.id };
    }

    const row = await insertRow<{ id: string }>("MatchNote", {
      matchId,
      authorId: ctx.user!.id,
      body,
      tags: JSON.stringify(tags),
      remindAt: remindAt ?? null,
    });
    revalidatePath("/partner");
    return { id: row.id };
  },
});

// ─── Delete ──────────────────────────────────────────────────────

const DeleteMatchNoteInput = z.object({
  id: z.string().min(1),
});

export const deleteMatchNoteAction = defineAction({
  name: "partner.match-note.delete",
  input: DeleteMatchNoteInput,
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.match-note.delete", limit: 30, windowSec: 60 },
  handler: async ({ id }, ctx) => {
    const note = await queryOne<{ id: string; partnerId: string }>(
      `SELECT n."id", m."partnerId"
       FROM "MatchNote" n
       JOIN "Match" m ON m."id" = n."matchId"
       WHERE n."id" = $1`,
      [id],
    );
    if (!note) fail({ code: "NOT_FOUND", resource: "MatchNote" });
    if (note!.partnerId !== ctx.user!.companyId) {
      fail({ code: "FORBIDDEN" });
    }
    await exec('DELETE FROM "MatchNote" WHERE "id" = $1', [id]);
    revalidatePath("/partner");
    return { ok: true as const };
  },
});

// ─── Server-side reader ─────────────────────────────────────────

export async function listMatchNotes(matchId: string) {
  const rows = await query<{
    id: string;
    body: string;
    tags: string;
    remindAt: Date | null;
    createdAt: Date;
    authorId: string;
    authorName: string | null;
    authorEmail: string;
  }>(
    `SELECT n."id", n."body", n."tags", n."remindAt", n."createdAt",
            u."id" AS "authorId", u."name" AS "authorName", u."email" AS "authorEmail"
     FROM "MatchNote" n
     JOIN "User" u ON u."id" = n."authorId"
     WHERE n."matchId" = $1
     ORDER BY n."createdAt" DESC`,
    [matchId],
  );
  return rows.map((n) => ({
    id: n.id,
    body: n.body,
    tags: safeArr<string>(n.tags),
    remindAt: n.remindAt,
    createdAt: n.createdAt,
    author: { id: n.authorId, name: n.authorName, email: n.authorEmail },
  }));
}

function safeArr<T>(input: string): T[] {
  try {
    const v = JSON.parse(input);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
