// Typed constants mirroring the TEXT columns Postgres uses for enum-like fields.
// We keep them as TEXT rather than native PG enums so adding a value is a plain
// deploy instead of a migration.

/**
 * User roles.
 *
 * - `CUSTOMER` — full tenant member (owns a Company, can create briefs)
 * - `PARTNER`  — services provider (member of a partner Company)
 * - `ADMIN`    — platform staff
 * - `GOOGLER`  — Google rep who refers customers (read-only on referrals)
 * - `COLLABORATOR` — invited-only account, no Company, scoped strictly to
 *   the briefs they've been added to via `BriefCollaborator`. They can
 *   upgrade themselves to `CUSTOMER` via `upgradeCollaboratorToCustomerAction`.
 */
export const USER_ROLES = [
  "CUSTOMER",
  "PARTNER",
  "ADMIN",
  "GOOGLER",
  "COLLABORATOR",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEAD_STATUSES = [
  "INVITED",
  "CLAIMED",
  "BRIEF_STARTED",
  "BRIEF_SUBMITTED",
  "MATCHED",
  "PROPOSAL_RECEIVED",
  "MEETING_SCHEDULED",
  "WON",
  "LOST",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const COMPANY_KINDS = ["CUSTOMER", "PARTNER"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];

export const PARTNER_TIER_VALUES = ["MEMBER", "PARTNER", "PREMIER"] as const;
export type PartnerTier = (typeof PARTNER_TIER_VALUES)[number];

export const BRIEF_STAGES = [
  "INTAKE",
  "SOURCING",
  "SHORTLIST",
  "REVIEW",
  "PROPOSALS",
  "SELECTION",
  "INTRODUCTION",
  "CLOSED",
] as const;
export type BriefStage = (typeof BRIEF_STAGES)[number];

export const BRIEF_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const SERVICE_CATEGORIES = [
  "RESELLING",
  "CONSULTING",
  "MANAGED",
  "SUPPORT",
  "TRAINING",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const PROCUREMENT_TYPES = ["DIRECT_GOOGLE", "VIA_RESELLER", "UNSURE"] as const;
export type Procurement = (typeof PROCUREMENT_TYPES)[number];

export const MATCH_STATUSES = [
  "SOURCED",
  "INVITED",          // outreach token issued, awaiting partner T&C click-in
  "PARTNER_ACCEPTED", // partner clicked T&C
  "PARTNER_DECLINED",
  "REVIEW_APPROVED",  // legacy: customer approved match for SoW share
  "SHORTLISTED",      // in customer's 5-card shortlist view
  "IN_FINAL_THREE",   // customer narrowed to 3 for meetings
  "DECLINED",
  "WITHDRAWN",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const COLLABORATOR_ROLES = ["VIEWER", "EDITOR"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export const COLLABORATOR_STATUSES = ["INVITED", "ACTIVE", "REMOVED"] as const;
export type CollaboratorStatus = (typeof COLLABORATOR_STATUSES)[number];

export const PROPOSAL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "SHORTLISTED",
  "SELECTED",
  "DECLINED",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
