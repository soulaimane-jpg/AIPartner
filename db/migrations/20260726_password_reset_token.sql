-- Password reset support. Tokens are stored as SHA-256 hashes so a database
-- leak can't be replayed to take over accounts; the raw token only ever exists
-- in the emailed link.
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
    ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
    ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
    ON "PasswordResetToken"("expiresAt");

DO $$
BEGIN
    ALTER TABLE "PasswordResetToken"
        ADD CONSTRAINT "PasswordResetToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
