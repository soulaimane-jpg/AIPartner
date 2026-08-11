"use server";

/**
 * Saved Views — user-pinned dashboard filters.
 *
 * URL query string remains the source of truth for dashboard filter
 * state. A `SavedView` is just a *name + ordering* for one of those
 * query strings so it can show in the left rail. We deliberately avoid
 * storing decoded filter state — it would drift the moment the URL
 * schema evolves.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow, updateRows, tx } from "@/lib/db";
import type { SavedViewRow } from "@/lib/db/rows";

// ─── Create / rename ─────────────────────────────────────────────

const UpsertSavedViewInput = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1).max(60),
  query: z.string().min(1).max(2000),
  pinned: z.boolean().optional().default(true),
});

export const upsertSavedViewAction = defineAction({
  name: "saved-view.upsert",
  input: UpsertSavedViewInput,
  output: z.object({ id: z.string() }),
  permission: "tenant.read", // any signed-in user manages their own
  rateLimit: { scope: "saved-view.upsert", limit: 30, windowSec: 60 },
  handler: async ({ id, label, query, pinned }, ctx) => {
    if (id) {
      const existing = await queryOne<{ id: string; userId: string }>(
        'SELECT "id", "userId" FROM "SavedView" WHERE "id" = $1',
        [id],
      );
      if (!existing || existing.userId !== ctx.user!.id) {
        fail({ code: "NOT_FOUND", resource: "SavedView" });
      }
      const [row] = await updateRows<{ id: string }>(
        "SavedView",
        { id },
        { label, query, pinned },
      );
      revalidatePath("/dashboard");
      return { id: row.id };
    }
    const last = await queryOne<{ rank: number }>(
      'SELECT "rank" FROM "SavedView" WHERE "userId" = $1 ORDER BY "rank" DESC LIMIT 1',
      [ctx.user!.id],
    );
    const row = await insertRow<{ id: string }>("SavedView", {
      userId: ctx.user!.id,
      label,
      query,
      pinned,
      rank: (last?.rank ?? 0) + 10,
    });
    revalidatePath("/dashboard");
    return { id: row.id };
  },
});

// ─── Delete ──────────────────────────────────────────────────────

const DeleteSavedViewInput = z.object({
  id: z.string().min(1),
});

export const deleteSavedViewAction = defineAction({
  name: "saved-view.delete",
  input: DeleteSavedViewInput,
  permission: "tenant.read",
  rateLimit: { scope: "saved-view.delete", limit: 30, windowSec: 60 },
  handler: async ({ id }, ctx) => {
    const existing = await queryOne<{ id: string; userId: string }>(
      'SELECT "id", "userId" FROM "SavedView" WHERE "id" = $1',
      [id],
    );
    if (!existing || existing.userId !== ctx.user!.id) {
      fail({ code: "NOT_FOUND", resource: "SavedView" });
    }
    await exec('DELETE FROM "SavedView" WHERE "id" = $1', [id]);
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});

// ─── Reorder ─────────────────────────────────────────────────────

const ReorderSavedViewsInput = z.object({
  /** Ordered list of saved-view IDs (top → bottom). */
  ids: z.array(z.string().min(1)).min(1).max(40),
});

export const reorderSavedViewsAction = defineAction({
  name: "saved-view.reorder",
  input: ReorderSavedViewsInput,
  permission: "tenant.read",
  rateLimit: { scope: "saved-view.reorder", limit: 30, windowSec: 60 },
  handler: async ({ ids }, ctx) => {
    const owned = await query<{ id: string }>(
      'SELECT "id" FROM "SavedView" WHERE "id" = ANY($1) AND "userId" = $2',
      [ids, ctx.user!.id],
    );
    if (owned.length !== ids.length) {
      fail({ code: "FORBIDDEN", reason: "Unknown view in reorder list" });
    }
    await tx(async (client) => {
      for (let i = 0; i < ids.length; i++) {
        await client.query(
          'UPDATE "SavedView" SET "rank" = $2, "updatedAt" = NOW() WHERE "id" = $1',
          [ids[i], (i + 1) * 10],
        );
      }
    });
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});

// ─── Server-side helpers ─────────────────────────────────────────

export async function listSavedViewsForUser(userId: string) {
  return query<SavedViewRow>(
    `SELECT * FROM "SavedView"
     WHERE "userId" = $1 AND "pinned" = TRUE
     ORDER BY "rank" ASC, "createdAt" ASC`,
    [userId],
  );
}
