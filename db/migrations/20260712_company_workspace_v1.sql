BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "challengeAreas" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "ProjectBrief" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ai_builder';
ALTER TABLE "ProjectBrief" ADD COLUMN IF NOT EXISTS "intentRoute" TEXT NOT NULL DEFAULT 'TECHNICAL';
ALTER TABLE "ProjectBrief" ADD COLUMN IF NOT EXISTS "deliveryModel" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProjectBrief" ADD COLUMN IF NOT EXISTS "cloudContextSnapshot" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "WorkspaceMembership" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "invitedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMembership_company_user_unique" UNIQUE ("companyId", "userId"),
  CONSTRAINT "WorkspaceMembership_role_check" CHECK ("role" IN ('OWNER', 'ADMIN', 'MEMBER')),
  CONSTRAINT "WorkspaceMembership_status_check" CHECK ("status" IN ('ACTIVE', 'REMOVED'))
);
CREATE INDEX IF NOT EXISTS "WorkspaceMembership_companyId_status_idx" ON "WorkspaceMembership"("companyId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMembership_one_owner_per_company" ON "WorkspaceMembership"("companyId") WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "WorkspaceInvite" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "acceptedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceInvite_role_check" CHECK ("role" IN ('ADMIN', 'MEMBER')),
  CONSTRAINT "WorkspaceInvite_status_check" CHECK ("status" IN ('INVITED', 'ACCEPTED', 'REVOKED', 'EXPIRED'))
);
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_companyId_status_idx" ON "WorkspaceInvite"("companyId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_companyId_email_invited_key" ON "WorkspaceInvite"("companyId", lower("email")) WHERE "status" = 'INVITED';

CREATE TABLE IF NOT EXISTS "CompanyCloudContext" (
  "id" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE REFERENCES "Company"("id") ON DELETE CASCADE,
  "providers" TEXT NOT NULL DEFAULT '[]',
  "resellerStatus" TEXT,
  "resellerWebsite" TEXT,
  "agreementStatus" TEXT,
  "agreementStartDate" DATE,
  "agreementEndDate" DATE,
  "minimumCommitmentUsd" DOUBLE PRECISION,
  "discountPct" DOUBLE PRECISION,
  "gcpGreenfield" BOOLEAN NOT NULL DEFAULT false,
  "renewalWindow" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BriefAccess" (
  "id" TEXT PRIMARY KEY,
  "briefId" TEXT NOT NULL REFERENCES "ProjectBrief"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'VIEWER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "grantedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BriefAccess_brief_user_unique" UNIQUE ("briefId", "userId"),
  CONSTRAINT "BriefAccess_role_check" CHECK ("role" IN ('EDITOR', 'APPROVER', 'REVIEWER', 'VIEWER')),
  CONSTRAINT "BriefAccess_status_check" CHECK ("status" IN ('ACTIVE', 'REMOVED'))
);
CREATE INDEX IF NOT EXISTS "BriefAccess_userId_status_idx" ON "BriefAccess"("userId", "status");

CREATE TABLE IF NOT EXISTS "BriefAccessRequest" (
  "id" TEXT PRIMARY KEY,
  "briefId" TEXT NOT NULL REFERENCES "ProjectBrief"("id") ON DELETE CASCADE,
  "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resolvedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BriefAccessRequest_status_check" CHECK ("status" IN ('PENDING', 'GRANTED', 'DENIED', 'CANCELLED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "BriefAccessRequest_brief_requester_pending_key" ON "BriefAccessRequest"("briefId", "requesterId") WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS "BriefAccessRequest_briefId_status_idx" ON "BriefAccessRequest"("briefId", "status");

INSERT INTO "WorkspaceMembership" ("id", "companyId", "userId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT md5('workspace-owner:' || u."companyId" || ':' || u."id"), u."companyId", u."id", 'OWNER', 'ACTIVE', NOW(), NOW(), NOW()
FROM "User" u
WHERE u."companyId" IS NOT NULL
  AND u."role" = 'CUSTOMER'
  AND u."id" = (
    SELECT u2."id" FROM "User" u2
    WHERE u2."companyId" = u."companyId" AND u2."role" = 'CUSTOMER'
    ORDER BY u2."createdAt" ASC, u2."id" ASC LIMIT 1
  )
ON CONFLICT ("companyId", "userId") DO NOTHING;

INSERT INTO "WorkspaceMembership" ("id", "companyId", "userId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT md5('workspace-member:' || u."companyId" || ':' || u."id"), u."companyId", u."id", 'MEMBER', 'ACTIVE', NOW(), NOW(), NOW()
FROM "User" u
WHERE u."companyId" IS NOT NULL
  AND u."role" = 'CUSTOMER'
  AND NOT EXISTS (SELECT 1 FROM "WorkspaceMembership" wm WHERE wm."companyId" = u."companyId" AND wm."userId" = u."id")
ON CONFLICT ("companyId", "userId") DO NOTHING;

INSERT INTO "BriefAccess" ("id", "briefId", "userId", "role", "status", "grantedById", "createdAt", "updatedAt")
SELECT md5('brief-editor:' || b."id" || ':' || b."ownerId"), b."id", b."ownerId", 'EDITOR', 'ACTIVE', b."ownerId", NOW(), NOW()
FROM "ProjectBrief" b
ON CONFLICT ("briefId", "userId") DO NOTHING;

INSERT INTO "BriefAccess" ("id", "briefId", "userId", "role", "status", "grantedById", "approvedAt", "createdAt", "updatedAt")
SELECT md5('brief-access:' || bc."briefId" || ':' || bc."userId"), bc."briefId", bc."userId",
  CASE WHEN bc."role" IN ('APPROVER', 'REVIEWER', 'VIEWER') THEN bc."role" ELSE 'VIEWER' END,
  'ACTIVE', bc."invitedById", bc."approvedAt", NOW(), NOW()
FROM "BriefCollaborator" bc
WHERE bc."userId" IS NOT NULL AND bc."status" = 'ACTIVE'
ON CONFLICT ("briefId", "userId") DO NOTHING;

COMMIT;
