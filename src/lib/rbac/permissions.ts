/**
 * Canonical list of every permission the platform recognises.
 *
 * **Adding a permission** is a two-step process:
 *   1. Append a stable string here. The string becomes a public identifier
 *      surfaced in `AuditLog.kind` and (later) the partner-facing OpenAPI.
 *      Once added, **never rename** — only deprecate by stopping its use.
 *   2. Wire it into `matrix.ts` for every role that should be able to
 *      perform it (allow / conditional / deny).
 *
 * Naming convention: `<resource>.<verb>` lower-case, dot-separated. Verbs
 * we use today: `create | read | update | delete | submit | archive |
 * triage | invite | accept | decline | shortlist | publish | configure`.
 */

export const PERMISSIONS = [
  // Briefs
  "brief.create",
  "brief.read",
  "brief.update",
  "brief.submit",
  "brief.archive",
  "brief.delete",

  // Brief collaboration
  "comment.create",
  "comment.resolve",
  "collaborator.invite",
  "collaborator.remove",
  "collaborator.approve",

  // Sourcing & matching
  "match.invite",
  "match.accept",
  "match.decline",
  "match.shortlist",
  "match.narrow",

  // Proposals
  "proposal.create",
  "proposal.update",
  "proposal.submit",
  "proposal.compare",
  "proposal.pin-winner",

  // Partner profile
  "partner.profile.update",
  "partner.profile.publish",
  "partner.directory.read",

  // Admin operations
  "admin.triage",
  "admin.bulk-action",
  "admin.partner-ops",
  "admin.flag.toggle",
  "admin.audit.read",

  // Tenant / company
  "tenant.read",
  "tenant.delete",
  "tenant.member.invite",

  // Authentication / SSO
  "auth.session.revoke",
  "auth.mfa.configure",
  "sso.configure",

  // Integrations
  "webhook.create",
  "webhook.update",
  "webhook.delete",
  "apikey.create",
  "apikey.revoke",

  // Data subject rights — every authenticated user can act on own data.
  "dsr.export",
  "dsr.erase",
  "dsr.rectify",

  // Audit
  "audit.read",

  // Brief Q&A — partners ask anonymous questions, customer answers
  "qa.ask",
  "qa.answer",
  "qa.read",

  // Trust centre — sub-processor registry (admin only, read is public)
  "subprocessor.create",
  "subprocessor.update",
  "subprocessor.retire",

  // plan-A production build ────────────────────────────────────
  // M1 — versioned legal documents
  "legal.accept",
  "admin.legal.manage",
  // M2 — company onboarding questions
  "onboarding.update",
  // M9 — clarification threads (three contexts, one mechanism)
  "clarification.create",
  "clarification.reply",
  "clarification.resolve",
  // M6 — partner lead flow
  "extension.request",
  "extension.resolve",
  // M7 — partner-side internal approval
  "proposal.approve-internal",
  // M8 — QC, anonymization, comparison release (admin gates)
  "admin.qc",
  "admin.anonymization.review",
  "admin.comparison.release",
  // M10 — company selection, voting & reveal
  "selection.select",
  "selection.reveal",
  "vote.cast",
  // M11 — meetings + deal reporting
  "meeting.confirm",
  "meeting.propose",
  "deal.report",
  // Partner file uploads (questionnaires + proposal documents)
  "match.upload",
  // M12 — platform settings + preference questions
  "admin.settings.configure",
  // 5-pillar partner intake — curated tag library
  "admin.tags.curate",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Type-safe builder for permission strings. */
export const perm = <P extends Permission>(p: P): P => p;
