-- Files a customer uploads while scoping a brief (PDF/DOCX/XLSX/CSV/TXT/MD +
-- images). The binary lives in GCS; only the storage path and the extracted
-- text are kept here so the AI builder can read the content without us pulling
-- the object back out of the bucket on every chat turn.
--
-- `companyId` is denormalised from the brief so tenant scoping and the
-- retention purge never need a join.
CREATE TABLE IF NOT EXISTS "BriefAttachment" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    -- Object name inside the bucket. Never a public URL: downloads go through
    -- a short-lived signed URL issued after an access check.
    "storagePath" TEXT NOT NULL,
    -- Plain-text rendering used as AI context. NULL for images, which are sent
    -- to the model as vision blocks instead.
    "extractedText" TEXT,
    -- pending | ready | failed | unsupported
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "extractionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BriefAttachment_briefId_idx"
    ON "BriefAttachment"("briefId");
CREATE INDEX IF NOT EXISTS "BriefAttachment_companyId_idx"
    ON "BriefAttachment"("companyId");
CREATE INDEX IF NOT EXISTS "BriefAttachment_createdAt_idx"
    ON "BriefAttachment"("createdAt");

DO $$
BEGIN
    ALTER TABLE "BriefAttachment"
        ADD CONSTRAINT "BriefAttachment_briefId_fkey"
        FOREIGN KEY ("briefId") REFERENCES "ProjectBrief"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "BriefAttachment"
        ADD CONSTRAINT "BriefAttachment_uploadedById_fkey"
        FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
