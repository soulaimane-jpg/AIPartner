-- Pre-flight for 20260812_column_domains.sql.
--
-- Run BEFORE validating the CHECK constraints. Any row returned here is a
-- value the application's state machines cannot produce, which means it
-- was written by a script, a migration, or a psql session — exactly what
-- the constraints exist to stop. Fix the data, then validate.
--
--   psql "$DB_URL" -f scripts/check-domain-violations.sql
--
-- A NULL is allowed everywhere: a CHECK passes when its expression is
-- NULL, so nullable columns need no special case.

\pset pager off

SELECT 'User.role' AS column, "role" AS value, COUNT(*) AS rows
  FROM "User"
 WHERE "role" IS NOT NULL
   AND "role" NOT IN ('ADMIN','COLLABORATOR','CUSTOMER','GOOGLER','PARTNER')
 GROUP BY "role"
UNION ALL
SELECT 'Company.kind', "kind", COUNT(*)
  FROM "Company"
 WHERE "kind" IS NOT NULL AND "kind" NOT IN ('CUSTOMER','PARTNER')
 GROUP BY "kind"
UNION ALL
SELECT 'Company.verificationStatus', "verificationStatus", COUNT(*)
  FROM "Company"
 WHERE "verificationStatus" IS NOT NULL
   AND "verificationStatus" NOT IN ('APPROVED','PENDING','REJECTED')
 GROUP BY "verificationStatus"
UNION ALL
SELECT 'PartnerProfile.tier', "tier", COUNT(*)
  FROM "PartnerProfile"
 WHERE "tier" IS NOT NULL AND "tier" NOT IN ('MEMBER','PARTNER','PREMIER')
 GROUP BY "tier"
UNION ALL
SELECT 'Lead.status', "status", COUNT(*)
  FROM "Lead"
 WHERE "status" IS NOT NULL
   AND "status" NOT IN ('BRIEF_STARTED','BRIEF_SUBMITTED','CLAIMED','INVITED',
                        'LOST','MATCHED','MEETING_SCHEDULED','PROPOSAL_RECEIVED','WON')
 GROUP BY "status"
UNION ALL
SELECT 'ProjectBrief.stage', "stage", COUNT(*)
  FROM "ProjectBrief"
 WHERE "stage" IS NOT NULL
   AND "stage" NOT IN ('CLOSED','INTAKE','INTRODUCTION','PROPOSALS','REVIEW',
                       'SELECTION','SHORTLIST','SOURCING')
 GROUP BY "stage"
UNION ALL
SELECT 'ProjectBrief.leadState', "leadState", COUNT(*)
  FROM "ProjectBrief"
 WHERE "leadState" IS NOT NULL
   AND "leadState" NOT IN ('CANCELLED','CLARIFICATION_NEEDED','COMPANY_SELECTED',
                           'COMPARISON_RELEASED','COMPLETED','DRAFT','DROPPED_OFF',
                           'IN_TRIAGE','LEAD_APPROVED','MEETINGS_SCHEDULED',
                           'PARTNERS_SELECTED','PROPOSALS_IN_REVIEW','REVEAL_APPROVED',
                           'SENT_TO_PARTNERS','STALLED','SUBMITTED')
 GROUP BY "leadState"
UNION ALL
SELECT 'ProjectBrief.status', "status", COUNT(*)
  FROM "ProjectBrief"
 WHERE "status" IS NOT NULL AND "status" NOT IN ('ACTIVE','ARCHIVED','DRAFT')
 GROUP BY "status"
UNION ALL
SELECT 'Match.status', "status", COUNT(*)
  FROM "Match"
 WHERE "status" IS NOT NULL
   AND "status" NOT IN ('DECLINED','EXPIRED','EXTENSION_REQUESTED','INVITED',
                        'IN_FINAL_THREE','NOT_SELECTED','PARTNER_ACCEPTED',
                        'PARTNER_DECLINED','PROPOSAL_EXPIRED','PROPOSAL_SUBMITTED',
                        'QC_PASSED','REVIEW_APPROVED','SELECTED','SHORTLISTED',
                        'SOURCED','WITHDRAWN')
 GROUP BY "status"
UNION ALL
SELECT 'Proposal.status', "status", COUNT(*)
  FROM "Proposal"
 WHERE "status" IS NOT NULL
   AND "status" NOT IN ('CLARIFICATION_NEEDED','DECLINED','DRAFT','INTERNALLY_APPROVED',
                        'INTERNAL_REVIEW','IN_QC','QC_PASSED','SELECTED','SHORTLISTED',
                        'SUBMITTED')
 GROUP BY "status"
UNION ALL
SELECT 'BriefCollaborator.role', "role", COUNT(*)
  FROM "BriefCollaborator"
 WHERE "role" IS NOT NULL AND "role" NOT IN ('EDITOR','VIEWER')
 GROUP BY "role"
UNION ALL
SELECT 'BriefCollaborator.status', "status", COUNT(*)
  FROM "BriefCollaborator"
 WHERE "status" IS NOT NULL AND "status" NOT IN ('ACTIVE','INVITED','REMOVED')
 GROUP BY "status"
UNION ALL
SELECT 'TimerInstance.timerType', "timerType", COUNT(*)
  FROM "TimerInstance"
 WHERE "timerType" IS NOT NULL
   AND "timerType" NOT IN ('company_select','lead_accept','proposal_submit',
                           'reveal_to_meeting','stagger_release','triage')
 GROUP BY "timerType"
UNION ALL
SELECT 'TimerInstance.status', "status", COUNT(*)
  FROM "TimerInstance"
 WHERE "status" IS NOT NULL
   AND "status" NOT IN ('active','cancelled','expired','satisfied')
 GROUP BY "status"
UNION ALL
SELECT 'RiskRadarReport.overall', "overall", COUNT(*)
  FROM "RiskRadarReport"
 WHERE "overall" IS NOT NULL
   AND "overall" NOT IN ('block','failed','info','warn')
 GROUP BY "overall"
ORDER BY 1, 2;
