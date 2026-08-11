/**
 * Canonical list of webhook event names.
 *
 * Adding an event is a one-step process: append the string here and
 * call `dispatchWebhook` from the relevant Server Action. Event names
 * are PUBLIC — once shipped, **never rename**, only deprecate by
 * stopping emission and documenting the new name.
 *
 * Naming convention: `<resource>.<verb-past-tense>` lower-case,
 * dot-separated. Verbs we use today: `created | updated | submitted |
 * archived | invited | accepted | declined | shortlisted | won | lost`.
 */

export const WEBHOOK_EVENTS = [
  // Brief lifecycle
  "brief.created",
  "brief.updated",
  "brief.submitted",
  "brief.stage_changed",
  "brief.archived",

  // Sourcing & matching
  "match.invited",
  "match.accepted",
  "match.declined",
  "match.shortlisted",
  "match.won",
  "match.lost",

  // Proposals
  "proposal.received",
  "proposal.updated",
  "proposal.pinned",

  // Q&A
  "qa.asked",
  "qa.answered",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Type-safe builder so callers get autocomplete. */
export const event = <E extends WebhookEvent>(e: E): E => e;
