-- Add rejectedAt column to BriefCollaborator so editors can reject
-- a brief with a note, parallel to the existing approvedAt column.
ALTER TABLE "BriefCollaborator"
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
