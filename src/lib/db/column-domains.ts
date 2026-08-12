/**
 * Canonical allowed values for the enum-like TEXT columns.
 *
 * Every lifecycle column was unconstrained TEXT with no CHECK anywhere in
 * the schema, so the state machines were enforced purely in application
 * code. That holds for app writes and is worthless against a `psql`
 * session, a migration, a backfill script, or a future service — exactly
 * the situations where a typo silently parks a brief in a state no code
 * can handle.
 *
 * This module is the single source the CHECK constraints are generated
 * from, and `tests/column-domains.test.ts` fails if the migration and
 * these lists drift apart.
 *
 * Note the unions: `MATCH_STATUSES` in `enums.ts` and the invite state
 * machine's `INVITE_STATES` had diverged (the machine writes `QC_PASSED`,
 * `PROPOSAL_SUBMITTED` and others that `enums.ts` never listed). A
 * constraint built from either list alone would have rejected live rows.
 */

import {
  BRIEF_STAGES,
  BRIEF_STATUSES,
  COLLABORATOR_ROLES,
  COLLABORATOR_STATUSES,
  COMPANY_KINDS,
  LEAD_STATES,
  LEAD_STATUSES,
  MATCH_STATUSES,
  PARTNER_TIER_VALUES,
  PROPOSAL_STATUSES,
  USER_ROLES,
} from "@/lib/enums";

/** Invite-machine states written to `Match.status`. */
const INVITE_MACHINE_STATES = [
  "SOURCED",
  "REVIEW_APPROVED",
  "SHORTLISTED",
  "IN_FINAL_THREE",
  "DECLINED",
  "INVITED",
  "PARTNER_ACCEPTED",
  "PARTNER_DECLINED",
  "EXTENSION_REQUESTED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_EXPIRED",
  "QC_PASSED",
  "SELECTED",
  "NOT_SELECTED",
  "EXPIRED",
  "WITHDRAWN",
] as const;

/** Proposal-machine states written to `Proposal.status`. */
const PROPOSAL_MACHINE_STATES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "INTERNALLY_APPROVED",
  "SUBMITTED",
  "IN_QC",
  "CLARIFICATION_NEEDED",
  "QC_PASSED",
  "SHORTLISTED",
  "SELECTED",
  "DECLINED",
] as const;

const TIMER_TYPE_VALUES = [
  "lead_accept",
  "proposal_submit",
  "company_select",
  "stagger_release",
  "triage",
  "reveal_to_meeting",
] as const;

const union = (...lists: readonly string[][]): string[] =>
  [...new Set(lists.flat())].sort();

export interface ColumnDomain {
  table: string;
  column: string;
  values: string[];
  /** Constraint name, derived so the migration and tests agree. */
  constraint: string;
}

function domain(
  table: string,
  column: string,
  values: readonly string[],
): ColumnDomain {
  return {
    table,
    column,
    values: [...new Set(values)].sort(),
    constraint: `${table}_${column}_check`,
  };
}

export const COLUMN_DOMAINS: ColumnDomain[] = [
  domain("User", "role", USER_ROLES),
  domain("Company", "kind", COMPANY_KINDS),
  domain("Company", "verificationStatus", [
    "PENDING",
    "APPROVED",
    "REJECTED",
  ]),
  // `tier` lives on PartnerProfile, not Company.
  domain("PartnerProfile", "tier", PARTNER_TIER_VALUES),
  domain("Lead", "status", LEAD_STATUSES),
  domain("ProjectBrief", "stage", BRIEF_STAGES),
  domain("ProjectBrief", "leadState", LEAD_STATES),
  domain("ProjectBrief", "status", BRIEF_STATUSES),
  domain("Match", "status", union([...MATCH_STATUSES], [...INVITE_MACHINE_STATES])),
  domain(
    "Proposal",
    "status",
    union([...PROPOSAL_STATUSES], [...PROPOSAL_MACHINE_STATES]),
  ),
  domain("BriefCollaborator", "role", COLLABORATOR_ROLES),
  domain("BriefCollaborator", "status", COLLABORATOR_STATUSES),
  domain("TimerInstance", "timerType", TIMER_TYPE_VALUES),
  domain("TimerInstance", "status", [
    "active",
    "satisfied",
    "expired",
    "cancelled",
  ]),
  domain("Engagement", "status", [
    "PENDING_ACCEPTANCE",
    "ACTIVE",
    "DELIVERED",
    "CANCELLED",
  ]),
  domain("EngagementMilestone", "status", [
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
    "BLOCKED",
  ]),
  domain("WorkspaceJoinRequest", "status", [
    "PENDING",
    "APPROVED",
    "DECLINED",
    "CANCELLED",
  ]),
  // 'failed' is written when the model call fails, so the submit gate can
  // tell "no risk found" apart from "the check never ran".
  domain("RiskRadarReport", "overall", ["info", "warn", "block", "failed"]),
];

/** `('A', 'B', …)` for use in a CHECK constraint. */
export function sqlValueList(values: string[]): string {
  return `(${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`;
}

/** The exact CHECK clause for a domain — nullable columns allow NULL. */
export function checkClause(d: ColumnDomain): string {
  return `"${d.column}" IN ${sqlValueList(d.values)}`;
}
