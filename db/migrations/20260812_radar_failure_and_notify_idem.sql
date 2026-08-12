-- Fail-closed Risk Radar + notification idempotency.
--
-- 1. `RiskRadarReport.failureReason`
--    A failed model call previously persisted nothing, so an Anthropic
--    outage silently removed the pre-submit risk gate and left no trace
--    that it had never run. Failures are now recorded with
--    overall='failed' so the submit gate can see the gap and admins can
--    see the rate.
--
-- 2. `Notification.idemKey`
--    `notify()` already threads an idemKey through to Email and JobRun,
--    both of which have unique indexes on it. Notification had no such
--    column, so every retry inserted another in-app row. Partial unique
--    index (WHERE NOT NULL) keeps historical rows valid.

ALTER TABLE "RiskRadarReport"
    ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

ALTER TABLE "Notification"
    ADD COLUMN IF NOT EXISTS "idemKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_idemKey_key"
    ON "Notification"("idemKey")
    WHERE "idemKey" IS NOT NULL;
