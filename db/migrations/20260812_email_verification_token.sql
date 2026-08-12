-- Email verification for credentials signups.
--
-- Before this, `emailVerified` was only ever set by the Google OAuth path, so
-- a credentials user could register as someone@bigcorp.com and immediately
-- receive that company's anonymized briefs. The profile page showed a
-- "Verification pending" badge that nothing could clear.
--
-- Same token design as "PasswordResetToken": only the SHA-256 hash is stored,
-- so a database leak can't be replayed; the raw token exists only in the link.
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
    ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
    ON "EmailVerificationToken"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
    ON "EmailVerificationToken"("expiresAt");

DO $$
BEGIN
    ALTER TABLE "EmailVerificationToken"
        ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Grandfather every existing account: verification applies to new signups
-- only, so nobody currently using the product is locked out.
UPDATE "User"
   SET "emailVerified" = COALESCE("emailVerified", NOW())
 WHERE "emailVerified" IS NULL;
