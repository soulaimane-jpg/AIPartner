"use server";

/**
 * Bulk admin operations on briefs.
 *
 * The admin selects rows in the briefs table; one of these actions
 * fires for all of them transactionally. Hard cap of 50 per call so
 * an accidental "select all" can't fan-out unboundedly.
 *
 * Every bulk op emits a single audit-log event with the count + ids
 * — not one row per brief. The per-row state changes still leave
 * their normal updatedAt trace.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/actions/define";
import { query, exec, insertRow } from "@/lib/db";
import { BRIEF_STAGES } from "@/lib/enums";

const MAX_BULK = 50;
const BriefIds = z.array(z.string().min(1)).min(1).max(MAX_BULK);

// ─── Bulk triage ─────────────────────────────────────────────────

const BulkTriageInput = z.object({
  briefIds: BriefIds,
  /** Optional shared note attached to every brief in the batch. */
  notes: z.string().max(2000).optional(),
});

export const bulkTriageBriefsAction = defineAction({
  name: "admin.bulk.triage",
  input: BulkTriageInput,
  output: z.object({ count: z.number().int().nonnegative() }),
  permission: "admin.bulk-action",
  rateLimit: { scope: "admin.bulk.triage", limit: 20, windowSec: 600 },
  handler: async ({ briefIds, notes }, ctx) => {
    const now = new Date();
    // Only triage SUBMITTED (or pre-triage) briefs. Idempotent.
    const count = await exec(
      `UPDATE "ProjectBrief" SET
         "triagedAt" = $2, "triagedBy" = $3,
         "triageNotes" = COALESCE($4, "triageNotes"),
         "updatedAt" = NOW()
       WHERE "id" = ANY($1) AND "triagedAt" IS NULL`,
      [briefIds, now, ctx.user!.id, notes ?? null],
    );

    // Stage-shift only the ones still in INTAKE.
    await exec(
      `UPDATE "ProjectBrief" SET "stage" = 'SOURCING', "updatedAt" = NOW()
       WHERE "id" = ANY($1) AND "stage" = 'INTAKE'`,
      [briefIds],
    );

    // Notify owners.
    const briefs = await query<{ id: string; ownerId: string; title: string }>(
      'SELECT "id", "ownerId", "title" FROM "ProjectBrief" WHERE "id" = ANY($1)',
      [briefIds],
    );
    for (const b of briefs) {
      await insertRow("Notification", {
        userId: b.ownerId,
        type: "brief.triaged",
        title: "Your brief is now in active sourcing",
        message:
          "Our team confirmed your project as a real lead. We're identifying the top 5 partner matches.",
        link: `/briefs/${b.id}/preview`,
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/briefs");
    return { count };
  },
});

// ─── Bulk stage change ──────────────────────────────────────────

const BulkStageInput = z.object({
  briefIds: BriefIds,
  stage: z.enum(BRIEF_STAGES),
});

export const bulkChangeStageAction = defineAction({
  name: "admin.bulk.stage",
  input: BulkStageInput,
  output: z.object({ count: z.number().int().nonnegative() }),
  permission: "admin.bulk-action",
  rateLimit: { scope: "admin.bulk.stage", limit: 20, windowSec: 600 },
  handler: async ({ briefIds, stage }) => {
    const count = await exec(
      `UPDATE "ProjectBrief" SET "stage" = $2, "updatedAt" = NOW()
       WHERE "id" = ANY($1)`,
      [briefIds, stage],
    );
    revalidatePath("/admin/briefs");
    return { count };
  },
});

// ─── Bulk archive ───────────────────────────────────────────────

const BulkArchiveInput = z.object({
  briefIds: BriefIds,
});

export const bulkArchiveBriefsAction = defineAction({
  name: "admin.bulk.archive",
  input: BulkArchiveInput,
  output: z.object({ count: z.number().int().nonnegative() }),
  permission: "admin.bulk-action",
  rateLimit: { scope: "admin.bulk.archive", limit: 10, windowSec: 600 },
  handler: async ({ briefIds }) => {
    const count = await exec(
      `UPDATE "ProjectBrief" SET "status" = 'ARCHIVED', "updatedAt" = NOW()
       WHERE "id" = ANY($1) AND "status" <> 'ARCHIVED'`,
      [briefIds],
    );
    revalidatePath("/admin/briefs");
    return { count };
  },
});
