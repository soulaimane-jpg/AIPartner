-- Add transcript column to Meeting for storing meeting transcripts
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "transcriptStatus" TEXT NOT NULL DEFAULT 'PENDING';
