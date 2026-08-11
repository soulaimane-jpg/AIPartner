/**
 * RBAC matrix: which role can perform which permission, optionally
 * gated by a runtime condition. Conditions are pure functions of
 * `(ctx, payload)` — they run **after** input validation but **before**
 * the action handler, so they can rely on parsed inputs.
 *
 * Reading the matrix:
 * - `true`  → unconditionally allowed for this role.
 * - `false` (or absent) → denied.
 * - `string` (condition key) → allowed iff `CONDITIONS[condition](...)` is true.
 *
 * Defence-in-depth note: even though the matrix authoritative, every
 * Server Action that touches Postgres is also expected to scope its
 * SQL query by tenant — Phase 2 ships RLS as the third layer.
 */

import type { UserRole } from "@/lib/enums";
import type { Permission } from "./permissions";

// ─── Condition keys ───────────────────────────────────────────────
//
// We keep these as string identifiers so the matrix stays serialisable
// and easy to render in the audit log / admin UI. The implementations
// live in `conditions.ts` and are looked up by `can()`.

export const CONDITION_KEYS = [
  "isOwnBrief", // ctx.user owns the brief referenced by payload.briefId
  "isOwnBriefOrCollaborator", // owner OR same-company OR active BriefCollaborator
  "isCompanyMember", // ctx.user.companyId matches the resource's tenant
  "isCollaborator", // ctx.user is on BriefCollaborator for payload.briefId
  "isEditingCollaborator", // ctx.user is an EDITOR collaborator
  "isMatchedPartner", // ctx.user.companyId == match.partnerId
  "isInvitedPartner", // ditto, only when match.status in [SOURCED, INVITED, ACCEPTED]
  "isOwnUser", // ctx.user.id == payload.userId
  "isOwnCompany", // ctx.user.companyId == payload.companyId
  "isAcceptedTerms", // partner has acceptedTermsAt set
  "secondaryApproval", // pending SecondaryApproval present + approved
] as const;

export type ConditionKey = (typeof CONDITION_KEYS)[number];

export type Ability = true | false | ConditionKey;

export type Matrix = Record<UserRole, Partial<Record<Permission, Ability>>>;

// ─── The matrix ───────────────────────────────────────────────────

export const MATRIX: Matrix = {
  CUSTOMER: {
    "brief.create": true,
    "brief.read": "isOwnBriefOrCollaborator",
    "brief.update": "isOwnBrief",
    "brief.submit": "isOwnBrief",
    "brief.archive": "isOwnBrief",
    "brief.delete": "isOwnBrief",
    "comment.create": "isCollaborator",
    "comment.resolve": "isOwnBrief",
    "collaborator.invite": "isOwnBrief",
    "collaborator.remove": "isOwnBrief",
    "match.shortlist": "isOwnBrief",
    "match.narrow": "isOwnBrief",
    "proposal.compare": "isOwnBrief",
    "proposal.pin-winner": "isOwnBrief",
    "partner.directory.read": true,
    "tenant.read": "isOwnCompany",
    "auth.session.revoke": "isOwnUser",
    "auth.mfa.configure": "isOwnUser",
    "dsr.export": "isOwnUser",
    "dsr.erase": "isOwnUser",
    "dsr.rectify": "isOwnUser",
    "audit.read": "isOwnUser",
    "qa.answer": "isOwnBrief",
    "qa.read": "isOwnBrief",

    // plan-A §2.2 — company side
    "legal.accept": true,
    "onboarding.update": "isOwnCompany",
    "clarification.create": "isOwnBriefOrCollaborator",
    "clarification.reply": "isOwnBriefOrCollaborator",
    "clarification.resolve": "isOwnBrief",
    "selection.select": "isOwnBrief",
    "selection.reveal": "isOwnBrief",
    "vote.cast": "isOwnBriefOrCollaborator",
    "meeting.confirm": "isOwnBrief",
  },

  COLLABORATOR: {
    // Strictly scoped to briefs this user appears on via BriefCollaborator.
    // No `brief.create`, no partner directory, no matching, no proposals.
    // VIEWER stays read-only; EDITOR can also edit.
    "brief.read": "isCollaborator",
    "brief.update": "isEditingCollaborator",
    "comment.create": "isCollaborator",
    "collaborator.approve": "isCollaborator", // handler also gates by row.role === EDITOR
    "qa.read": "isCollaborator",
    "qa.answer": "isCollaborator",
    "legal.accept": true,
    "vote.cast": "isCollaborator",
    "auth.session.revoke": "isOwnUser",
    "auth.mfa.configure": "isOwnUser",
    "dsr.export": "isOwnUser",
    "dsr.erase": "isOwnUser",
    "dsr.rectify": "isOwnUser",
    "audit.read": "isOwnUser",
  },

  PARTNER: {
    "brief.read": "isMatchedPartner",
    "comment.create": "isMatchedPartner",
    "match.accept": "isInvitedPartner",
    "match.decline": "isInvitedPartner",
    "proposal.create": "isMatchedPartner",
    "proposal.update": "isMatchedPartner",
    "proposal.submit": "isMatchedPartner",
    "partner.profile.update": "isOwnCompany",
    "partner.profile.publish": "isAcceptedTerms",
    "partner.directory.read": true,
    "tenant.read": "isOwnCompany",
    "tenant.delete": "secondaryApproval",
    "tenant.member.invite": "isOwnCompany",
    "auth.session.revoke": "isOwnUser",
    "auth.mfa.configure": "isOwnUser",
    "sso.configure": "isOwnCompany",
    "webhook.create": "isOwnCompany",
    "webhook.update": "isOwnCompany",
    "webhook.delete": "isOwnCompany",
    "qa.ask": "isMatchedPartner",
    "qa.read": "isMatchedPartner",
    "qa.answer": "isMatchedPartner",
    "apikey.create": "isOwnCompany",
    "apikey.revoke": "isOwnCompany",
    "dsr.export": "isOwnUser",
    "dsr.erase": "isOwnUser",
    "dsr.rectify": "isOwnUser",
    "audit.read": "isOwnUser",

    // plan-A §2.2 — partner side
    "legal.accept": true,
    "clarification.create": "isMatchedPartner",
    "clarification.reply": "isMatchedPartner",
    "extension.request": "isMatchedPartner",
    "proposal.approve-internal": "isMatchedPartner",
    "meeting.confirm": "isMatchedPartner",
    "meeting.propose": "isMatchedPartner",
    "deal.report": "isMatchedPartner",
    "match.upload": "isMatchedPartner",
  },

  ADMIN: {
    // Admins get every permission — but **all sensitive actions are
    // still audited** and certain ones (tenant.delete) require a
    // secondary admin approval.
    "brief.create": true,
    "brief.read": true,
    "brief.update": true,
    "brief.submit": true,
    "brief.archive": true,
    "brief.delete": true,
    "comment.create": true,
    "comment.resolve": true,
    "collaborator.invite": true,
    "collaborator.remove": true,
    "collaborator.approve": true,
    "match.invite": true,
    "match.accept": true,
    "match.decline": true,
    "match.shortlist": true,
    "match.narrow": true,
    "proposal.create": true,
    "proposal.update": true,
    "proposal.submit": true,
    "proposal.compare": true,
    "proposal.pin-winner": true,
    "partner.profile.update": true,
    "partner.profile.publish": true,
    "partner.directory.read": true,
    "admin.triage": true,
    "admin.bulk-action": true,
    "admin.partner-ops": true,
    "admin.flag.toggle": true,
    "admin.audit.read": true,
    "tenant.read": true,
    "tenant.delete": "secondaryApproval",
    "tenant.member.invite": true,
    "auth.session.revoke": true,
    "auth.mfa.configure": true,
    "sso.configure": true,
    "webhook.create": true,
    "webhook.update": true,
    "webhook.delete": true,
    "apikey.create": true,
    "apikey.revoke": true,
    "dsr.export": true,
    "dsr.erase": true,
    "dsr.rectify": true,
    "audit.read": true,
    "qa.ask": true,
    "qa.answer": true,
    "qa.read": true,
    "subprocessor.create": true,
    "subprocessor.update": true,
    "subprocessor.retire": true,

    // plan-A §2.2 — platform admin has full pipeline control
    "legal.accept": true,
    "admin.legal.manage": true,
    "onboarding.update": true,
    "clarification.create": true,
    "clarification.reply": true,
    "clarification.resolve": true,
    "extension.request": true, // on behalf of partner
    "extension.resolve": true,
    "proposal.approve-internal": false, // explicitly ⛔ in §2.2
    "admin.qc": true,
    "admin.anonymization.review": true,
    "admin.comparison.release": true,
    "selection.select": true, // on behalf
    "selection.reveal": true, // on behalf
    "vote.cast": false, // admins observe votes (👁), never cast
    "meeting.confirm": true,
    "meeting.propose": true,
    "deal.report": true,
    "match.upload": true,
    "admin.settings.configure": true,
    "admin.tags.curate": true,
  },

  GOOGLER: {
    // Googlers can refer customers but never see internal triage data.
    "brief.create": true, // referral creates a draft brief on behalf of customer
    "brief.read": "isCollaborator",
    "comment.create": "isCollaborator",
    "partner.directory.read": true,
    "auth.session.revoke": "isOwnUser",
    "auth.mfa.configure": "isOwnUser",
    "dsr.export": "isOwnUser",
    "dsr.erase": "isOwnUser",
    "dsr.rectify": "isOwnUser",
    "audit.read": "isOwnUser",
  },
};
