-- Typed pricing on ProposalSection.
--
-- `Engagement.contractValueCents` / `feeAmountCents` are integer cents —
-- correct. But the engagement's commercial terms are meant to be derived
-- from the accepted proposal, and proposal pricing lived entirely inside
-- `ProposalSection.pricing` as JSON text, where the database can enforce
-- neither currency, nor scale, nor non-negativity. A typed target fed by
-- an untyped source.
--
-- The JSON stays (it holds the per-option breakdown the builder renders);
-- these columns hoist the headline figure the engagement is derived from
-- into checkable columns, backfilled from the existing JSON.

ALTER TABLE "ProposalSection"
    ADD COLUMN IF NOT EXISTS "pricingModel"        TEXT,
    ADD COLUMN IF NOT EXISTS "pricingAmountCents"  BIGINT,
    ADD COLUMN IF NOT EXISTS "pricingCurrency"     TEXT;

-- Domain + sanity constraints. NOT VALID first so the ALTER is cheap;
-- validated below after the backfill.
DO $$
BEGIN
    ALTER TABLE "ProposalSection"
        ADD CONSTRAINT "ProposalSection_pricingModel_check"
        CHECK ("pricingModel" IN ('fixed', 'tm', 'tiered', 'resell')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ProposalSection"
        ADD CONSTRAINT "ProposalSection_pricingAmount_check"
        CHECK ("pricingAmountCents" IS NULL OR "pricingAmountCents" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ProposalSection"
        ADD CONSTRAINT "ProposalSection_pricingCurrency_check"
        CHECK ("pricingCurrency" IS NULL OR "pricingCurrency" ~ '^[A-Z]{3}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Backfill from the existing JSON ───────────────────────────────
--
-- `pricing` is TEXT holding `{"model":"fixed","options":[{"amountCents":…}]}`.
-- The headline figure is the sum of the option amounts, which is what the
-- comparison grid and any engagement derivation would use. Rows whose
-- JSON is absent or unparseable are left NULL rather than guessed at.
UPDATE "ProposalSection" ps
   SET "pricingModel" = j->>'model',
       "pricingAmountCents" = (
           SELECT SUM((opt->>'amountCents')::bigint)
             FROM jsonb_array_elements(COALESCE(j->'options', '[]'::jsonb)) opt
            WHERE opt->>'amountCents' IS NOT NULL
              AND opt->>'amountCents' ~ '^[0-9]+$'
       ),
       -- No per-proposal currency existed; the platform quotes in EUR,
       -- matching Engagement.currency's default.
       "pricingCurrency" = 'EUR'
  FROM (
      SELECT "id" AS sid,
             CASE
                 WHEN "pricing" IS NULL OR btrim("pricing") = '' THEN NULL
                 WHEN "pricing" ~ '^\s*\{' THEN "pricing"::jsonb
                 ELSE NULL
             END AS j
        FROM "ProposalSection"
  ) src
 WHERE ps."id" = src.sid
   AND src.j IS NOT NULL
   AND src.j->>'model' IN ('fixed', 'tm', 'tiered', 'resell');

-- Validate now that the data conforms.
DO $$
BEGIN
    ALTER TABLE "ProposalSection" VALIDATE CONSTRAINT "ProposalSection_pricingModel_check";
    ALTER TABLE "ProposalSection" VALIDATE CONSTRAINT "ProposalSection_pricingAmount_check";
    ALTER TABLE "ProposalSection" VALIDATE CONSTRAINT "ProposalSection_pricingCurrency_check";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ProposalSection_pricingModel_idx"
    ON "ProposalSection"("pricingModel")
    WHERE "pricingModel" IS NOT NULL;
