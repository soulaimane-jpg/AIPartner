import "server-only";

import { exec, query } from "@/lib/db";

/**
 * Cron liveness tracking.
 *
 * Every `/api/cron/*` route wraps its work in `withHeartbeat`, so the
 * `CronRun` table always answers "did this actually run, and did it
 * work?". Without it a dead scheduler is indistinguishable from a
 * quiet week — which is exactly how the GDPR retention purge went
 * unnoticed for months.
 */

export const CRON_JOBS = {
  timers: {
    label: "Timer sweep",
    /** Cloud Scheduler: */
    expectedIntervalMinutes: 15,
    description: "Fires deadline reminders and expires overdue timers.",
  },
  jobs: {
    label: "Job queue",
    expectedIntervalMinutes: 10,
    description: "Drains the background job queue, including outbound email.",
  },
  digest: {
    label: "Weekly digest",
    expectedIntervalMinutes: 60 * 24 * 7,
    description: "Sends the partner/customer digest.",
  },
  retention: {
    label: "Retention purge",
    expectedIntervalMinutes: 60 * 24,
    description: "GDPR art. 5(1)(e) storage-limitation purge.",
  },
  "partner-freshness": {
    label: "Partner freshness",
    expectedIntervalMinutes: 60 * 24 * 7,
    description: "Queues re-scrapes for stale partner profiles.",
  },
} as const;

export type CronJobName = keyof typeof CRON_JOBS;

export interface CronRunRow {
  job: string;
  lastStartedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastDurationMs: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalRuns: string | number;
  expectedIntervalMinutes: number | null;
  updatedAt: Date;
}

/**
 * Run `fn` and record the outcome. Heartbeat failures never mask the
 * job's own result — observability must not break the thing it
 * observes.
 */
export async function withHeartbeat<T>(
  job: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  await exec(
    `INSERT INTO "CronRun" ("job", "lastStartedAt", "expectedIntervalMinutes", "updatedAt")
     VALUES ($1, NOW(), $2, NOW())
     ON CONFLICT ("job") DO UPDATE SET
       "lastStartedAt" = NOW(),
       "expectedIntervalMinutes" = EXCLUDED."expectedIntervalMinutes",
       "updatedAt" = NOW()`,
    [job, CRON_JOBS[job].expectedIntervalMinutes],
  ).catch(() => undefined);

  try {
    const result = await fn();
    await exec(
      `UPDATE "CronRun" SET
         "lastSuccessAt" = NOW(),
         "lastDurationMs" = $2,
         "lastError" = NULL,
         "consecutiveFailures" = 0,
         "totalRuns" = "totalRuns" + 1,
         "updatedAt" = NOW()
       WHERE "job" = $1`,
      [job, Date.now() - startedAt],
    ).catch(() => undefined);
    return result;
  } catch (err) {
    await exec(
      `UPDATE "CronRun" SET
         "lastFailureAt" = NOW(),
         "lastDurationMs" = $2,
         "lastError" = $3,
         "consecutiveFailures" = "consecutiveFailures" + 1,
         "totalRuns" = "totalRuns" + 1,
         "updatedAt" = NOW()
       WHERE "job" = $1`,
      [
        job,
        Date.now() - startedAt,
        err instanceof Error ? err.message.slice(0, 1000) : "unknown error",
      ],
    ).catch(() => undefined);
    throw err;
  }
}

/**
 * Escalate stale/failing jobs to admins.
 *
 * Called from the most frequent job (the timer sweep) because a
 * scheduler that has stopped cannot report its own absence — the
 * watchdog has to be something that is still running.
 *
 * `never_run` is excluded: a job that has genuinely never executed is
 * normal on a fresh deployment and would page on every boot.
 * Idempotency is keyed to the hour so a persistent outage nags daily
 * rather than every 15 minutes.
 */
export async function alertOnUnhealthyCrons(now = new Date()): Promise<number> {
  const health = await getCronHealth(now);
  const unhealthy = health.filter(
    (h) => h.status === "stale" || h.status === "failing",
  );
  if (unhealthy.length === 0) return 0;

  const { notifyAdmins } = await import("@/lib/notify");
  const bucket = `${now.toISOString().slice(0, 13)}`;
  await notifyAdmins({
    event: "cron.unhealthy_admin",
    vars: {
      jobs: unhealthy
        .map(
          (h) =>
            `- ${h.label}: ${h.status}${
              h.lastSuccessAt
                ? ` (last success ${h.minutesSinceSuccess}m ago)`
                : " (never succeeded)"
            }${h.lastError ? ` — ${h.lastError.slice(0, 120)}` : ""}`,
        )
        .join("\n"),
    },
    link: "/admin",
    idemKey: `cron-unhealthy:${bucket}:${unhealthy.map((h) => h.job).join(",")}`,
  });
  return unhealthy.length;
}

export type CronHealthStatus = "ok" | "stale" | "failing" | "never_run";

export interface CronHealth {
  job: CronJobName;
  label: string;
  description: string;
  status: CronHealthStatus;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  expectedIntervalMinutes: number;
  minutesSinceSuccess: number | null;
}

/**
 * Health for every known job.
 *
 * A job is `stale` once it has missed its window with 100% slack — a
 * single skipped tick shouldn't page anyone, two in a row should.
 */
export async function getCronHealth(now = new Date()): Promise<CronHealth[]> {
  const rows = await query<CronRunRow>('SELECT * FROM "CronRun"').catch(
    () => [] as CronRunRow[],
  );
  const byJob = new Map(rows.map((r) => [r.job, r]));

  return (Object.keys(CRON_JOBS) as CronJobName[]).map((job) => {
    const def = CRON_JOBS[job];
    const row = byJob.get(job);
    const lastSuccessAt = row?.lastSuccessAt ?? null;
    const minutesSinceSuccess = lastSuccessAt
      ? Math.floor((now.getTime() - lastSuccessAt.getTime()) / 60_000)
      : null;

    let status: CronHealthStatus;
    if (!row || !lastSuccessAt) {
      status = "never_run";
    } else if ((row.consecutiveFailures ?? 0) > 0) {
      status = "failing";
    } else if (
      minutesSinceSuccess !== null &&
      minutesSinceSuccess > def.expectedIntervalMinutes * 2
    ) {
      status = "stale";
    } else {
      status = "ok";
    }

    return {
      job,
      label: def.label,
      description: def.description,
      status,
      lastSuccessAt,
      lastFailureAt: row?.lastFailureAt ?? null,
      lastError: row?.lastError ?? null,
      consecutiveFailures: row?.consecutiveFailures ?? 0,
      expectedIntervalMinutes: def.expectedIntervalMinutes,
      minutesSinceSuccess,
    };
  });
}
