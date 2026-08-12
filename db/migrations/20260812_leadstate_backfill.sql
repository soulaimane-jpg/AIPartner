-- Backfill `ProjectBrief.leadState` from the legacy `stage` column.
--
-- Why: `leadState` is now the canonical pipeline field and `stage` is derived
-- from it by `transitionLead`. Until now the main customer submit path never
-- called the state machine, so most briefs still carry the default
-- leadState='DRAFT' while `stage` had advanced. `getLeadState()` papered over
-- that by inferring at read time — which meant the inference had to be
-- repeated everywhere, and the audit trail was missing its first hops.
--
-- This applies the same mapping as `inferLeadStateFromLegacyStage()` once, in
-- the database, so reads no longer depend on inference.
--
-- Only rows still sitting at the DRAFT default are touched: any brief that
-- has genuinely been through the state machine already has the correct value
-- and must not be overwritten (e.g. a real DRAFT at stage INTAKE stays DRAFT,
-- and COMPANY_SELECTED must not be clobbered back to COMPARISON_RELEASED).

UPDATE "ProjectBrief"
   SET "leadState" = CASE "stage"
        WHEN 'INTAKE'       THEN 'DRAFT'
        WHEN 'SOURCING'     THEN 'IN_TRIAGE'
        WHEN 'SHORTLIST'    THEN 'SENT_TO_PARTNERS'
        WHEN 'REVIEW'       THEN 'SENT_TO_PARTNERS'
        WHEN 'PROPOSALS'    THEN 'PROPOSALS_IN_REVIEW'
        WHEN 'SELECTION'    THEN 'COMPARISON_RELEASED'
        WHEN 'INTRODUCTION' THEN 'REVEAL_APPROVED'
        WHEN 'CLOSED'       THEN 'COMPLETED'
        ELSE 'DRAFT'
       END
 WHERE "leadState" = 'DRAFT'
   AND "stage" <> 'INTAKE';

-- Archived briefs are terminal regardless of where they stopped.
UPDATE "ProjectBrief"
   SET "leadState" = 'CANCELLED'
 WHERE "status" = 'ARCHIVED'
   AND "leadState" NOT IN ('CANCELLED', 'COMPLETED');

CREATE INDEX IF NOT EXISTS "ProjectBrief_leadState_idx"
    ON "ProjectBrief"("leadState");
