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
import { query, exec } from "@/lib/db";
import { notify } from "@/lib/notify";
import { LEAD_STATES } from "@/lib/enums";
import {
  advanceLeadIfAllowed,
  transitionLead,
} from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { satisfyTimer } from "@/lib/timers";

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

    // Advance each lead through the state machine so the hop is
    // audited per brief. `advanceLeadIfAllowed` no-ops for anything
    // already past triage, matching the old conditional UPDATE.
    const actor = userActor(ctx.user!.id, ctx.user!.companyId);
    for (const briefId of briefIds) {
      await advanceLeadIfAllowed({
        briefId,
        to: "IN_TRIAGE",
        actor,
        meta: { via: "admin.bulk.triage" },
      });
      await satisfyTimer("brief", briefId, "triage");
    }

    // Notify owners.
    const briefs = await query<{ id: string; ownerId: string; title: string }>(
      'SELECT "id", "ownerId", "title" FROM "ProjectBrief" WHERE "id" = ANY($1)',
      [briefIds],
    );
    for (const b of briefs) {
      await notify({
        event: "brief.triaged",
        recipients: [{ userId: b.ownerId }],
        vars: { briefTitle: b.title },
        link: `/briefs/${b.id}/preview`,
        briefId: b.id,
        idemKey: `triaged:${b.id}`,
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
  leadState: z.enum(LEAD_STATES),
});

/**
 * Bulk pipeline move. Each brief goes through the state machine, so a
 * brief that can't legally make the hop is skipped rather than being
 * force-written into a state its `leadState` disagrees with. The
 * returned count is the number actually moved.
 */
export const bulkChangeStageAction = defineAction({
  name: "admin.bulk.stage",
  input: BulkStageInput,
  output: z.object({ count: z.number().int().nonnegative() }),
  permission: "admin.bulk-action",
  rateLimit: { scope: "admin.bulk.stage", limit: 20, windowSec: 600 },
  handler: async ({ briefIds, leadState }, ctx) => {
    const actor = userActor(ctx.user!.id, ctx.user!.companyId);
    let count = 0;
    for (const briefId of briefIds) {
      try {
        await transitionLead({
          briefId,
          to: leadState,
          actor,
          reason: "Admin bulk pipeline change",
        });
        count++;
      } catch {
        // Illegal hop for this brief — skip it, keep the batch going.
      }
    }
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
