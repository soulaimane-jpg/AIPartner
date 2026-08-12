-- Acceptance as a first-class event.
--
-- The pipeline used to end before the actual business event: selection →
-- reveal → meeting → a self-reported `DealReport`, with no contract, no
-- acceptance artefact and no fee basis. "The customer accepted this partner's
-- proposal" existed only as an inference from a form someone filled in.
--
-- `Engagement` records the acceptance itself: which proposal was accepted, on
-- what commercial terms, acknowledged by whom and when. `DealReport` stays as
-- the outcome log; this is the agreement it reports on.
--
-- Scope note: this is an acknowledgement record, NOT e-signature. It captures
-- who accepted, when, from which IP/UA — the same evidence standard already
-- used for partner T&C acceptance on `Match`. Wiring a real e-signature
-- provider is a separate decision.

CREATE TABLE IF NOT EXISTS "Engagement" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "proposalId" TEXT,
    "partnerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    -- PENDING_ACCEPTANCE | ACTIVE | DELIVERED | CANCELLED
    "status" TEXT NOT NULL DEFAULT 'PENDING_ACCEPTANCE',

    -- Agreed commercial terms, snapshotted at acceptance so later edits to
    -- the proposal can't silently rewrite what was agreed.
    "acceptedScope" TEXT,
    "contractValueCents" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "startDate" TIMESTAMP(3),
    "durationMonths" INTEGER,

    -- Platform fee basis. Nullable: commercial model is still a business
    -- decision, and a wrong default is worse than an explicit null.
    "feeModel" TEXT,
    "feeBps" INTEGER,
    "feeAmountCents" BIGINT,

    -- Acceptance evidence.
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "acceptedByName" TEXT,
    "acceptedIp" TEXT,
    "acceptedUa" TEXT,

    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- One engagement per match.
CREATE UNIQUE INDEX IF NOT EXISTS "Engagement_matchId_key"
    ON "Engagement"("matchId");
CREATE INDEX IF NOT EXISTS "Engagement_briefId_idx"
    ON "Engagement"("briefId");
CREATE INDEX IF NOT EXISTS "Engagement_partnerId_status_idx"
    ON "Engagement"("partnerId", "status");

-- Delivery milestones, so "what happened after the meeting" is answerable.
CREATE TABLE IF NOT EXISTS "EngagementMilestone" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    -- PENDING | IN_PROGRESS | COMPLETED | BLOCKED
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EngagementMilestone_engagementId_rank_idx"
    ON "EngagementMilestone"("engagementId", "rank");

DO $$
BEGIN
    ALTER TABLE "EngagementMilestone"
        ADD CONSTRAINT "EngagementMilestone_engagementId_fkey"
        FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
