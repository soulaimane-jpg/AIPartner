-- Partner Smart Intake: 5-pillar structured profile + curated tag library.
--
-- Design notes:
--   * Every change here is ADDITIVE and nullable. The existing JSON-blob
--     columns on "PartnerProfile" (specializations, expertiseAreas, …) are
--     retained and dual-written for one release so rollback is trivial.
--   * "Tag" is the canonical library. Partners may suggest tags, which land
--     as status='pending' and are promoted by an admin (or automatically
--     once 3 independent partners suggest the same thing).
--   * "PartnerTag" is the join. Facet is denormalized onto the join row so
--     reads for a single facet avoid a join back to "Tag".

-- ─── Tag library ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    -- Canonical machine name. Stable; renames go through "mergedIntoId".
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    -- platform | workload | vertical | compliance | product |
    -- asset_category | engagement_model | collaboration | metric |
    -- specialization
    "facet" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    -- global | pending | rejected
    "status" TEXT NOT NULL DEFAULT 'pending',
    -- JSON array of alternate spellings that resolve to this tag, so
    -- "GCP" / "Google Cloud" / "Google Cloud Platform" collapse to one.
    "synonyms" TEXT NOT NULL DEFAULT '[]',
    -- Number of partner profiles currently using the tag.
    "useCount" INTEGER NOT NULL DEFAULT 0,
    -- Distinct partners who proposed it while it was still pending.
    -- At >= 3 the admin queue flags it for promotion.
    "suggestedByCount" INTEGER NOT NULL DEFAULT 0,
    -- Soft merge: old references stay resolvable after de-duplication.
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- One canonical slug per facet. Case-insensitive so "BigQuery" and
-- "bigquery" cannot both exist.
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_facet_slug_key"
    ON "Tag"("facet", lower("slug"));
CREATE INDEX IF NOT EXISTS "Tag_status_idx" ON "Tag"("status");
CREATE INDEX IF NOT EXISTS "Tag_facet_idx" ON "Tag"("facet");
CREATE INDEX IF NOT EXISTS "Tag_useCount_idx" ON "Tag"("useCount" DESC);

DO $$
BEGIN
    ALTER TABLE "Tag"
        ADD CONSTRAINT "Tag_mergedIntoId_fkey"
        FOREIGN KEY ("mergedIntoId") REFERENCES "Tag"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ─── Partner ↔ Tag join ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PartnerTag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    -- Denormalized from "Tag" so per-facet reads skip the join.
    "facet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerTag_company_tag_key"
    ON "PartnerTag"("companyId", "tagId");
CREATE INDEX IF NOT EXISTS "PartnerTag_companyId_facet_idx"
    ON "PartnerTag"("companyId", "facet");
CREATE INDEX IF NOT EXISTS "PartnerTag_tagId_idx" ON "PartnerTag"("tagId");

DO $$
BEGIN
    ALTER TABLE "PartnerTag"
        ADD CONSTRAINT "PartnerTag_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "PartnerTag"
        ADD CONSTRAINT "PartnerTag_tagId_fkey"
        FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ─── Pillar scalars on PartnerProfile ─────────────────────────
--
-- All nullable: existing rows stay valid and the wizard fills them in.

ALTER TABLE "PartnerProfile"
    -- Pillar 2 — IP & accelerators.
    -- ipAssets: [{name, category, description, access, impact, timeSaved}]
    ADD COLUMN IF NOT EXISTS "ipAssets" TEXT NOT NULL DEFAULT ('[]'),
    ADD COLUMN IF NOT EXISTS "resellPlatforms" TEXT,

    -- Pillar 3 — commercials.
    ADD COLUMN IF NOT EXISTS "engagementModels" TEXT NOT NULL DEFAULT ('[]'),
    ADD COLUMN IF NOT EXISTS "minDealSize" TEXT,
    -- [lowMonths, highMonths]
    ADD COLUMN IF NOT EXISTS "typicalContractMonths" TEXT,
    ADD COLUMN IF NOT EXISTS "pocOffering" TEXT,
    ADD COLUMN IF NOT EXISTS "pocFixedFee" INTEGER,
    ADD COLUMN IF NOT EXISTS "pocTurnaroundDays" INTEGER,

    -- Pillar 4 — operations & capacity.
    ADD COLUMN IF NOT EXISTS "benchAvailability" TEXT,
    -- 0-100, percentage that is senior/lead.
    ADD COLUMN IF NOT EXISTS "seniorityRatio" INTEGER,
    ADD COLUMN IF NOT EXISTS "collaborationStyles" TEXT NOT NULL DEFAULT ('[]'),

    -- Pillar 5 — proof & outcomes.
    -- {cloudSavingsPct: [lo, hi], migrationMonths: [lo, hi]}
    ADD COLUMN IF NOT EXISTS "valueRanges" TEXT NOT NULL DEFAULT ('{}'),
    ADD COLUMN IF NOT EXISTS "referenceAvailability" TEXT,

    -- Freshness & onboarding state.
    ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastScrapedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "profileStrength" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "onboardingStep" TEXT;

CREATE INDEX IF NOT EXISTS "PartnerProfile_lastVerifiedAt_idx"
    ON "PartnerProfile"("lastVerifiedAt");
CREATE INDEX IF NOT EXISTS "PartnerProfile_profileStrength_idx"
    ON "PartnerProfile"("profileStrength" DESC);

-- ─── Re-scrape change proposals ───────────────────────────────
--
-- The quarterly re-scrape NEVER writes to a profile directly. It records
-- a proposed change per field; the partner accepts or rejects each one.

CREATE TABLE IF NOT EXISTS "ProfileChangeProposal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    -- directory | website
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    -- Registry field key, or a legacy PartnerProfile column name.
    "fieldKey" TEXT NOT NULL,
    "currentValue" TEXT,
    "proposedValue" TEXT,
    -- pending | accepted | rejected | superseded
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileChangeProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProfileChangeProposal_companyId_status_idx"
    ON "ProfileChangeProposal"("companyId", "status");
CREATE INDEX IF NOT EXISTS "ProfileChangeProposal_createdAt_idx"
    ON "ProfileChangeProposal"("createdAt");

DO $$
BEGIN
    ALTER TABLE "ProfileChangeProposal"
        ADD CONSTRAINT "ProfileChangeProposal_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ProfileChangeProposal"
        ADD CONSTRAINT "ProfileChangeProposal_resolvedById_fkey"
        FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
