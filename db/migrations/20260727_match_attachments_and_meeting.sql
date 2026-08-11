-- Partner-side meeting slot proposals on a Match.
-- Mirrors the customer-side ProjectBrief.meetingProposedSlots pattern:
-- the partner proposes up to 3 slots after accepting; the admin confirms one.
ALTER TABLE "Match"
    ADD COLUMN IF NOT EXISTS "meetingProposedSlots" TEXT,
    ADD COLUMN IF NOT EXISTS "meetingAgenda" TEXT,
    ADD COLUMN IF NOT EXISTS "meetingConfirmedAt" TIMESTAMP(3);

-- Files a partner uploads against a match: questionnaires (to get more
-- answers from the customer) and proposal documents (PDF/DOC/XLS/images).
-- The binary lives in GCS under proposals/<partnerId>/<matchId>/<uuid>-<name>;
-- only the storage path and metadata are kept here.
CREATE TABLE IF NOT EXISTS "MatchAttachment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "uploadedById" TEXT,
    -- "questionnaire" | "proposal"
    "kind" TEXT NOT NULL DEFAULT 'proposal',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchAttachment_matchId_idx"
    ON "MatchAttachment"("matchId");
CREATE INDEX IF NOT EXISTS "MatchAttachment_partnerId_idx"
    ON "MatchAttachment"("partnerId");
CREATE INDEX IF NOT EXISTS "MatchAttachment_kind_idx"
    ON "MatchAttachment"("kind");
CREATE INDEX IF NOT EXISTS "MatchAttachment_createdAt_idx"
    ON "MatchAttachment"("createdAt");

DO $$
BEGIN
    ALTER TABLE "MatchAttachment"
        ADD CONSTRAINT "MatchAttachment_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "Match"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "MatchAttachment"
        ADD CONSTRAINT "MatchAttachment_briefId_fkey"
        FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "MatchAttachment"
        ADD CONSTRAINT "MatchAttachment_uploadedById_fkey"
        FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
