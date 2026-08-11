/**
 * Background job queue — DB-backed, idempotent, retry-aware.
 *
 * Design goals:
 *   - **Zero new infra.** Postgres is already a strong consistent
 *     store; we use it as the queue until throughput demands more.
 *   - **Idempotent enqueue.** Re-enqueueing with the same `idemKey`
 *     within the dedup window returns the existing `JobRun`.
 *   - **Single shape.** The same record fuels the queue, the retry
 *     logic, the DLQ, and the admin replay UI.
 *
 * Two public entry points:
 *   - `enqueue(jobName, payload, { idemKey, runAt })` — schedule work.
 *   - `runDueJobs(handler)` — invoked by `/api/cron/jobs`. Pops up to
 *     N due jobs, runs the handler, records outcome.
 *
 * Handlers register themselves in `JOB_HANDLERS` below — keeping the
 * router in one file means the runner can typecheck the universe of
 * jobs at compile time.
 */

import "server-only";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";
import type { JobRunRow } from "@/lib/db/rows";

export interface EnqueueOptions {
  /** Unique key for dedup. Same key + jobName = no-op. */
  idemKey?: string;
  /** Schedule the job for the future. Defaults to "now". */
  runAt?: Date;
  /** Override default max attempts (8). */
  maxAttempts?: number;
  /** Correlation IDs. */
  requestId?: string;
  traceId?: string;
}

export async function enqueue(
  jobName: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<{ id: string; deduped: boolean }> {
  if (options.idemKey) {
    const existing = await queryOne<{ id: string }>(
      'SELECT "id" FROM "JobRun" WHERE "jobName" = $1 AND "idemKey" = $2',
      [jobName, options.idemKey],
    );
    if (existing) {
      return { id: existing.id, deduped: true };
    }
  }
  const row = await insertRow<JobRunRow>("JobRun", {
    jobName,
    idemKey: options.idemKey ?? null,
    payload: JSON.stringify(payload),
    status: "queued",
    scheduledFor: options.runAt ?? new Date(),
    maxAttempts: options.maxAttempts ?? 8,
    requestId: options.requestId ?? null,
    traceId: options.traceId ?? null,
  });
  return { id: row.id, deduped: false };
}

/** Exponential backoff with jitter — 30s × 2^(attempt-1) ± 20%. */
function nextBackoffMs(attempt: number): number {
  const base = 30_000 * 2 ** Math.max(0, attempt - 1);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.min(base + jitter, 6 * 3_600_000); // cap at 6h
}

/**
 * Handler signature: receives the parsed payload, returns void or a
 * structured result. Throwing schedules a retry.
 */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export interface RunDueJobsOptions {
  /** Hard upper bound on jobs run per invocation. */
  batchSize?: number;
  /** Map of jobName → handler. Unknown jobs are pushed to DLQ. */
  handlers: Record<string, JobHandler>;
}

export interface RunDueJobsResult {
  picked: number;
  succeeded: number;
  retried: number;
  failed: number;
  dlq: number;
}

/**
 * Pop and run jobs whose `scheduledFor <= now`. Caller invokes this
 * from a cron route. Each run is wrapped in try/catch — a handler
 * failure schedules a retry or escalates to DLQ on the final attempt.
 */
export async function runDueJobs(
  options: RunDueJobsOptions,
): Promise<RunDueJobsResult> {
  const batchSize = options.batchSize ?? 25;
  const now = new Date();
  const due = await query<JobRunRow>(
    `SELECT * FROM "JobRun"
     WHERE "status" = 'queued' AND "scheduledFor" <= $1
     ORDER BY "scheduledFor" ASC
     LIMIT $2`,
    [now, batchSize],
  );

  let picked = 0;
  let succeeded = 0;
  let retried = 0;
  let failed = 0;
  let dlq = 0;

  for (const job of due) {
    // Optimistic claim — flip status atomically so a concurrent cron
    // can't double-run the same row.
    const claimed = await exec(
      `UPDATE "JobRun" SET "status" = 'running', "startedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'queued'`,
      [job.id],
    );
    if (claimed === 0) continue;
    picked++;

    const handler = options.handlers[job.jobName];
    if (!handler) {
      await updateRows(
        "JobRun",
        { id: job.id },
        {
          status: "dlq",
          error: `No handler registered for ${job.jobName}`,
          finishedAt: new Date(),
        },
      );
      dlq++;
      continue;
    }

    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>;
      await handler(payload);
      await updateRows(
        "JobRun",
        { id: job.id },
        { status: "success", finishedAt: new Date() },
      );
      succeeded++;
    } catch (err) {
      const isFinal = job.attempt >= job.maxAttempts;
      const message =
        err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      if (isFinal) {
        await updateRows(
          "JobRun",
          { id: job.id },
          {
            status: "dlq",
            error: message,
            finishedAt: new Date(),
          },
        );
        dlq++;
        failed++;
      } else {
        const next = new Date(Date.now() + nextBackoffMs(job.attempt));
        await updateRows(
          "JobRun",
          { id: job.id },
          {
            status: "queued",
            attempt: job.attempt + 1,
            scheduledFor: next,
            nextAttemptAt: next,
            error: message,
            startedAt: null,
          },
        );
        retried++;
      }
    }
  }

  return { picked, succeeded, retried, failed, dlq };
}

// ─── Job-handler registry (extended as new jobs come online) ─────

import { sendEmail } from "@/lib/email/provider";
import { deliverWebhook } from "@/lib/webhooks/deliver";

export const JOB_HANDLERS: Record<string, JobHandler> = {
  /**
   * Generic transactional-email job. Payload:
   *   { toAddress: string; subject: string; body: string; kind?: string }
   */
  "email.send": async (payload) => {
    const to = String(payload.toAddress ?? "");
    if (!to) throw new Error("missing toAddress");
    const result = await sendEmail({
      toAddress: to,
      subject: String(payload.subject ?? ""),
      body: String(payload.body ?? ""),
      kind: typeof payload.kind === "string" ? payload.kind : "system",
    });
    if (!result.ok) throw new Error(result.error);
  },

  /**
   * Outbound webhook delivery. Payload: `{ deliveryId: string }`.
   * Handler signs the body, fires HTTP, records the outcome, and
   * throws on failure so the runner schedules a retry.
   */
  "webhook.deliver": async (payload) => {
    const id = typeof payload.deliveryId === "string" ? payload.deliveryId : "";
    if (!id) throw new Error("missing deliveryId");
    await deliverWebhook(id);
  },

  /**
   * Quarterly freshness sweep. No payload — finds partners whose profiles are
   * due a re-check and enqueues one `partner.rescrape` each.
   */
  "partner.rescrape.sweep": async () => {
    const { sweepDueRescrapes } = await import("@/lib/jobs/partner-rescrape");
    await sweepDueRescrapes();
  },

  /**
   * Re-read one partner's public sources and record field-level change
   * proposals. Payload: `{ companyId: string }`.
   *
   * Never writes to the profile — see `lib/jobs/partner-rescrape.ts`.
   */
  "partner.rescrape": async (payload) => {
    const companyId =
      typeof payload.companyId === "string" ? payload.companyId : "";
    if (!companyId) throw new Error("missing companyId");
    const { rescrapePartner } = await import("@/lib/jobs/partner-rescrape");
    await rescrapePartner(companyId);
  },
};
