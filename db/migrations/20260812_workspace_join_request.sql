-- Domain-based workspace discovery.
--
-- `signUpCustomerAction` always created a brand-new Company, so two colleagues
-- from the same organisation silently ended up in two invisible tenants with
-- separate briefs and no way to find each other.
--
-- Deliberately a REQUEST, not an auto-join: brief access is granted by
-- `companyId`, so silently attaching a new signup to an existing workspace
-- because their email domain matched would hand anyone who can register at
-- `@bigcorp.com` every brief that company has ever written. An owner or admin
-- approves instead.

CREATE TABLE IF NOT EXISTS "WorkspaceJoinRequest" (
    "id" TEXT NOT NULL,
    -- The workspace the requester wants to join.
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    -- The stub company created for them at signup, archived on approval.
    "requesterCompanyId" TEXT,
    -- Domain evidence that produced the suggestion.
    "emailDomain" TEXT NOT NULL,
    -- PENDING | APPROVED | DECLINED | CANCELLED
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceJoinRequest_pkey" PRIMARY KEY ("id")
);

-- One live request per (workspace, requester).
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceJoinRequest_pending_key"
    ON "WorkspaceJoinRequest"("companyId", "requesterId")
    WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "WorkspaceJoinRequest_companyId_status_idx"
    ON "WorkspaceJoinRequest"("companyId", "status");

DO $$
BEGIN
    ALTER TABLE "WorkspaceJoinRequest"
        ADD CONSTRAINT "WorkspaceJoinRequest_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
