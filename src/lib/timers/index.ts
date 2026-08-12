/**
 * Timer / deadline engine — plan-A §7.
 *
 * Persistent `TimerInstance` rows + a sweep invoked from
 * `/api/cron/timers` (≤5-min interval). On expiry the sweep runs the
 * timer's `onExpiryAction` (state transition + notifications) and
 * marks the row `expired`. Reminder offsets come from
 * `reminder_offsets_hours` — **no duration constants in code**.
 *
 * Timer creation/satisfaction/extension are all audit-logged.
 */

import "server-only";
import type { PoolClient } from "pg";
import { query, exec, insertRow, updateRows } from "@/lib/db";
import type { TimerInstanceRow } from "@/lib/db/rows";
import { getSetting } from "@/lib/settings";
import { captureError } from "@/lib/observability";
import { runExpiryAction, runReminder } from "./handlers";

export const TIMER_TYPES = [
  "lead_accept",
  "proposal_submit",
  "company_select",
  "stagger_release",
  // Admin-side obligations. Without these the only party with no
  // enforced deadline was the one that most often blocks the funnel.
  "triage",
  "reveal_to_meeting",
] as const;
export type TimerType = (typeof TIMER_TYPES)[number];

export interface StartTimerOptions {
  entityType: "brief" | "match";
  entityId: string;
  timerType: TimerType;
  deadlineAt: Date;
  /** Defaults to the timer type — routed by the sweep on expiry. */
  onExpiryAction?: string;
  /** Context for the expiry handler: briefId, matchId, … */
  meta?: Record<string, unknown>;
  /**
   * Join a caller's transaction so the timer commits atomically with the
   * transition that created it. A submitted lead with no triage SLA was
   * previously a possible outcome of a mid-request crash.
   */
  client?: PoolClient;
}

async function auditTimer(
  kind: string,
  timerId: string,
  payload: unknown,
  client?: PoolClient,
) {
  try {
    await insertRow(
      "AuditLog",
      {
        actorId: null,
        kind: `timer.${kind}`,
        targetId: timerId,
        targetType: "TimerInstance",
        payload: JSON.stringify(payload ?? {}),
      },
      { noUpdatedAt: true, client },
    );
  } catch (err) {
    // Inside a caller transaction the error must propagate, or the
    // surrounding COMMIT fails later with a confusing message.
    if (client) throw err;
    captureError(err, { scope: "timer", kind, timerId });
  }
}

/**
 * Start (or restart) a timer. Any previous *active* timer of the same
 * (entity, type) is cancelled first — one live timer per slot.
 */
export async function startTimer(opts: StartTimerOptions): Promise<string> {
  const cancelSql = `UPDATE "TimerInstance" SET "status" = 'cancelled', "updatedAt" = NOW()
     WHERE "entityType" = $1 AND "entityId" = $2 AND "timerType" = $3 AND "status" = 'active'`;
  const cancelParams = [opts.entityType, opts.entityId, opts.timerType];
  if (opts.client) await opts.client.query(cancelSql, cancelParams);
  else await exec(cancelSql, cancelParams);

  const timer = await insertRow<TimerInstanceRow>(
    "TimerInstance",
    {
      entityType: opts.entityType,
      entityId: opts.entityId,
      timerType: opts.timerType,
      deadlineAt: opts.deadlineAt,
      onExpiryAction: opts.onExpiryAction ?? opts.timerType,
      meta: JSON.stringify(opts.meta ?? {}),
    },
    { client: opts.client },
  );
  await auditTimer(
    "started",
    timer.id,
    {
      entityType: opts.entityType,
      entityId: opts.entityId,
      timerType: opts.timerType,
      deadlineAt: opts.deadlineAt.toISOString(),
    },
    opts.client,
  );
  return timer.id;
}

/** Mark the active timer for (entity, type) satisfied — e.g. partner accepted before T1 ran out. */
export async function satisfyTimer(
  entityType: "brief" | "match",
  entityId: string,
  timerType: TimerType,
  client?: PoolClient,
): Promise<void> {
  const sql = `UPDATE "TimerInstance" SET "status" = 'satisfied', "satisfiedAt" = NOW(), "updatedAt" = NOW()
     WHERE "entityType" = $1 AND "entityId" = $2 AND "timerType" = $3 AND "status" = 'active'
     RETURNING "id"`;
  const params = [entityType, entityId, timerType];
  const timers = client
    ? (await client.query<{ id: string }>(sql, params)).rows
    : await query<{ id: string }>(sql, params);
  for (const t of timers) {
    await auditTimer(
      "satisfied",
      t.id,
      { entityType, entityId, timerType },
      client,
    );
  }
}

/** Push the deadline out (extension grant). Marks the row `extended` history-wise via audit; row stays active. */
export async function extendTimer(
  entityType: "brief" | "match",
  entityId: string,
  timerType: TimerType,
  addHours: number,
): Promise<Date | null> {
  const [timer] = await query<TimerInstanceRow>(
    `SELECT * FROM "TimerInstance"
     WHERE "entityType" = $1 AND "entityId" = $2 AND "timerType" = $3 AND "status" = 'active'
     LIMIT 1`,
    [entityType, entityId, timerType],
  );
  if (!timer) return null;
  const newDeadline = new Date(
    timer.deadlineAt.getTime() + addHours * 3_600_000,
  );
  await updateRows(
    "TimerInstance",
    { id: timer.id },
    { deadlineAt: newDeadline, remindersSent: "[]" },
  );
  await auditTimer("extended", timer.id, {
    entityType,
    entityId,
    timerType,
    addHours,
    newDeadline: newDeadline.toISOString(),
  });
  return newDeadline;
}

/** Cancel without satisfying (invite withdrawn, lead cancelled…). */
export async function cancelTimer(
  entityType: "brief" | "match",
  entityId: string,
  timerType?: TimerType,
): Promise<void> {
  await exec(
    `UPDATE "TimerInstance" SET "status" = 'cancelled', "updatedAt" = NOW()
     WHERE "entityType" = $1 AND "entityId" = $2 AND "status" = 'active'
       AND ($3::text IS NULL OR "timerType" = $3)`,
    [entityType, entityId, timerType ?? null],
  );
}

export interface SweepResult {
  expired: number;
  reminded: number;
  errors: number;
}

/**
 * The sweep — invoked by `/api/cron/timers`.
 *   1. Fire reminders for active timers inside a configured offset.
 *   2. Expire timers past their deadline and run their expiry action.
 * Each timer is isolated in try/catch so one bad row can't wedge the
 * whole sweep.
 */
export async function sweepTimers(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = { expired: 0, reminded: 0, errors: 0 };
  const offsets = await getSetting("reminder_offsets_hours");

  // ── Reminders ────────────────────────────────────────────────
  const maxOffset = Math.max(...offsets, 0);
  const reminderHorizon = new Date(now.getTime() + maxOffset * 3_600_000);
  const upcoming = await query<TimerInstanceRow>(
    `SELECT * FROM "TimerInstance"
     WHERE "status" = 'active' AND "deadlineAt" > $1 AND "deadlineAt" <= $2
     LIMIT 200`,
    [now, reminderHorizon],
  );

  for (const timer of upcoming) {
    try {
      const hoursLeft = (timer.deadlineAt.getTime() - now.getTime()) / 3_600_000;
      let sent: number[] = [];
      try {
        sent = JSON.parse(timer.remindersSent) as number[];
      } catch {
        sent = [];
      }
      // Fire the smallest un-sent offset that we're inside of.
      const due = offsets
        .filter((o) => hoursLeft <= o && !sent.includes(o))
        .sort((a, b) => a - b)[0];
      if (due === undefined) continue;

      // Claim the offset BEFORE sending, with a compare-and-swap on the
      // value we read. Expiry already did this; reminders did not — they
      // read, sent, then wrote back, so two overlapping sweeps both
      // passed the `!sent.includes(o)` check and the partner got the
      // same reminder twice. Claiming first also means a crash mid-send
      // drops a reminder rather than duplicating it, which is the
      // better failure direction for a deadline nudge.
      const claimed = await exec(
        `UPDATE "TimerInstance"
            SET "remindersSent" = $2, "updatedAt" = NOW()
          WHERE "id" = $1
            AND "status" = 'active'
            AND "remindersSent" = $3`,
        [
          timer.id,
          JSON.stringify([...sent, due]),
          timer.remindersSent,
        ],
      );
      if (claimed === 0) continue; // another sweep got there first

      await runReminder(timer, due, Math.max(1, Math.round(hoursLeft)));
      result.reminded++;
    } catch (err) {
      result.errors++;
      // eslint-disable-next-line no-console
      console.error(`[timers] reminder failed for ${timer.id}`, err);
    }
  }

  // ── Expiries ─────────────────────────────────────────────────
  const due = await query<TimerInstanceRow>(
    `SELECT * FROM "TimerInstance"
     WHERE "status" = 'active' AND "deadlineAt" <= $1
     ORDER BY "deadlineAt" ASC
     LIMIT 100`,
    [now],
  );

  for (const timer of due) {
    try {
      // Optimistic claim so concurrent sweeps can't double-fire.
      const claimed = await exec(
        `UPDATE "TimerInstance" SET "status" = 'expired', "expiredAt" = $2, "updatedAt" = NOW()
         WHERE "id" = $1 AND "status" = 'active'`,
        [timer.id, now],
      );
      if (claimed === 0) continue;

      await auditTimer("expired", timer.id, {
        entityType: timer.entityType,
        entityId: timer.entityId,
        timerType: timer.timerType,
      });
      await runExpiryAction(timer);
      result.expired++;
    } catch (err) {
      result.errors++;
      // eslint-disable-next-line no-console
      console.error(`[timers] expiry failed for ${timer.id}`, err);
    }
  }

  return result;
}
