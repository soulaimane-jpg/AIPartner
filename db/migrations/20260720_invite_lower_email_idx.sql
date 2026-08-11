-- The invite upsert in workspace-invites.ts targets
-- ON CONFLICT ("companyId", lower("email")) WHERE "status" = 'INVITED',
-- which requires this exact expression index to exist.
-- Applied to prod manually on 2026-07-20 (scripts/fix-invite-schema.cjs).
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_companyId_lower_email_invited_key"
ON "WorkspaceInvite" ("companyId", lower("email")) WHERE "status" = 'INVITED';
