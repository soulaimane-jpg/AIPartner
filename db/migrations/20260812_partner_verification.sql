-- Partner verification gate.
--
-- Until now `signUpPartnerAction` created a Company(kind='PARTNER') that was
-- immediately sourceable and invitable — anyone could self-declare as a
-- "vetted Google Cloud partner", which is the platform's core promise.
--
-- Design notes:
--   * Additive and backwards-compatible. Every EXISTING partner is backfilled
--     to 'APPROVED' so production sourcing is unaffected by this migration.
--     Only signups from here on start as 'PENDING'.
--   * Domain evidence is recorded (not trusted): we compare the signup email
--     domain against the profile website/directory URL and store the outcome
--     for the admin reviewing the queue. An admin decision is always required.
--   * Sourcing and invites filter on verificationStatus = 'APPROVED'.

ALTER TABLE "Company"
    -- PENDING | APPROVED | REJECTED
    ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "verifiedById" TEXT,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    -- Set when the signup email domain matched the profile website/directory
    -- domain. Evidence for the reviewer, never an automatic approval.
    ADD COLUMN IF NOT EXISTS "domainVerifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "signupEmailDomain" TEXT;

-- Backfill: everything that exists today keeps working.
UPDATE "Company"
   SET "verificationStatus" = 'APPROVED',
       "verifiedAt" = COALESCE("verifiedAt", NOW())
 WHERE "verificationStatus" = 'PENDING';

-- Customers are not subject to partner vetting; keep them APPROVED so the
-- column has one meaning ("may participate") across both kinds.
UPDATE "Company"
   SET "verificationStatus" = 'APPROVED'
 WHERE "kind" <> 'PARTNER' AND "verificationStatus" <> 'APPROVED';

CREATE INDEX IF NOT EXISTS "Company_kind_verificationStatus_idx"
    ON "Company"("kind", "verificationStatus");
