-- Cron observability.
--
-- Everything time-based in this product depends on external schedulers hitting
-- /api/cron/*: T1/T2 deadlines, reminders, STALLED leads, queued email,
-- digests, the GDPR retention purge and partner freshness re-checks. Until now
-- nothing recorded whether those calls actually happened, so a silently broken
-- scheduler looked exactly like a quiet week — which is how the retention purge
-- came to never run in production.
--
-- One row per job, upserted on every run. Cheap to write, and it makes
-- "when did this last succeed?" answerable without digging through logs.

CREATE TABLE IF NOT EXISTS "CronRun" (
    -- The job name, e.g. 'timers'. One row per job (not per execution):
    -- history lives in the logs; this table answers liveness.
    "job" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastError" TEXT,
    -- Consecutive failures since the last success — drives escalation.
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" BIGINT NOT NULL DEFAULT 0,
    -- How often the job is expected to run. A job that hasn't succeeded in
    -- more than this (plus slack) is considered stale by the health panel.
    "expectedIntervalMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("job")
);
