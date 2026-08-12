/**
 * Lead lifecycle state machine — plan-A §5.1.
 *
 * The "lead" is the pipeline object wrapping an approved brief; it
 * lives on `ProjectBrief.leadState`. **No ad-hoc status writes** —
 * every transition goes through `transitionLead()` which enforces the
 * §5.1 transition table, syncs the legacy `stage` column for older
 * UI, and audit-logs actor + from-state + to-state (golden rule 3).
 */

import "server-only";
import type { PoolClient } from "pg";
import { queryOne, updateRows } from "@/lib/db";
import { LEAD_STATES, type LeadState } from "@/lib/enums";
import { auditTransition, type TransitionActor } from "./transition";

// Single definition, shared with client-safe schemas/UI labels.
export { LEAD_STATES, type LeadState } from "@/lib/enums";

/**
 * §5.1 transition table. `CANCELLED` is reachable from any state via
 * `cancelLead()` (admin action, reason required) — not listed here.
 */
const LEAD_TRANSITIONS: Record<LeadState, readonly LeadState[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_TRIAGE"],
  IN_TRIAGE: ["CLARIFICATION_NEEDED", "LEAD_APPROVED"],
  CLARIFICATION_NEEDED: ["IN_TRIAGE"],
  LEAD_APPROVED: ["PARTNERS_SELECTED"],
  PARTNERS_SELECTED: ["SENT_TO_PARTNERS"],
  SENT_TO_PARTNERS: ["PROPOSALS_IN_REVIEW", "STALLED"],
  PROPOSALS_IN_REVIEW: ["COMPARISON_RELEASED"],
  COMPARISON_RELEASED: ["COMPANY_SELECTED"],
  COMPANY_SELECTED: ["REVEAL_APPROVED"],
  REVEAL_APPROVED: ["MEETINGS_SCHEDULED"],
  MEETINGS_SCHEDULED: ["COMPLETED", "DROPPED_OFF"],
  COMPLETED: [],
  DROPPED_OFF: ["COMPLETED"],
  CANCELLED: [],
  STALLED: ["PARTNERS_SELECTED"], // admin re-selects partners
};

/**
 * Legacy `ProjectBrief.stage` value for each lead state — kept in
 * sync on every transition so pre-plan-A pages keep rendering.
 */
export const LEAD_STATE_TO_LEGACY_STAGE: Record<LeadState, string> = {
  DRAFT: "INTAKE",
  SUBMITTED: "SOURCING",
  IN_TRIAGE: "SOURCING",
  CLARIFICATION_NEEDED: "SOURCING",
  LEAD_APPROVED: "SOURCING",
  PARTNERS_SELECTED: "REVIEW",
  SENT_TO_PARTNERS: "REVIEW",
  PROPOSALS_IN_REVIEW: "PROPOSALS",
  COMPARISON_RELEASED: "SELECTION",
  COMPANY_SELECTED: "SELECTION",
  REVEAL_APPROVED: "INTRODUCTION",
  MEETINGS_SCHEDULED: "INTRODUCTION",
  COMPLETED: "CLOSED",
  DROPPED_OFF: "CLOSED",
  CANCELLED: "CLOSED",
  STALLED: "REVIEW",
};

/**
 * Linear progress order for the happy path. Used to decide whether a
 * requested state is "behind" where the lead already is, so an
 * opportunistic advance can no-op instead of throwing.
 *
 * Terminal/■side states are deliberately absent — they are never the
 * target of an opportunistic advance.
 */
const LEAD_PROGRESS_ORDER: readonly LeadState[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_TRIAGE",
  "LEAD_APPROVED",
  "PARTNERS_SELECTED",
  "SENT_TO_PARTNERS",
  "PROPOSALS_IN_REVIEW",
  "COMPARISON_RELEASED",
  "COMPANY_SELECTED",
  "REVEAL_APPROVED",
  "MEETINGS_SCHEDULED",
  "COMPLETED",
];

function progressIndex(state: LeadState): number {
  return LEAD_PROGRESS_ORDER.indexOf(state);
}

/**
 * Best-effort mapping for briefs created before `leadState` existed
 * (their `leadState` is the default "DRAFT" but `stage` is advanced).
 */
export function inferLeadStateFromLegacyStage(stage: string): LeadState {
  switch (stage) {
    case "INTAKE":
      return "DRAFT";
    case "SOURCING":
      return "IN_TRIAGE";
    case "SHORTLIST":
    case "REVIEW":
      return "SENT_TO_PARTNERS";
    case "PROPOSALS":
      return "PROPOSALS_IN_REVIEW";
    case "SELECTION":
      return "COMPARISON_RELEASED";
    case "INTRODUCTION":
      return "REVEAL_APPROVED";
    case "CLOSED":
      return "COMPLETED";
    default:
      return "DRAFT";
  }
}

export function isLeadState(value: string): value is LeadState {
  return (LEAD_STATES as readonly string[]).includes(value);
}

export function canTransitionLead(from: LeadState, to: LeadState): boolean {
  if (to === "CANCELLED") return from !== "CANCELLED";
  return LEAD_TRANSITIONS[from]?.includes(to) ?? false;
}

export class LeadTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    reason?: string,
  ) {
    super(
      reason ??
        `Illegal lead transition ${from} → ${to} (see plan-A §5.1)`,
    );
    this.name = "LeadTransitionError";
  }
}

export interface TransitionLeadOptions {
  briefId: string;
  to: LeadState;
  actor: TransitionActor;
  /** Required for CANCELLED. Stored in the audit payload. */
  reason?: string;
  /** Extra audit payload context. */
  meta?: Record<string, unknown>;
  /**
   * Join a caller's transaction so the transition commits atomically
   * with its side effects. When supplied, the brief row is locked
   * `FOR UPDATE` for the remainder of that transaction, which serialises
   * concurrent transitions on the same brief.
   */
  client?: PoolClient;
}

/**
 * Execute a guarded lead transition. Throws `LeadTransitionError` on
 * an illegal edge. Returns the new state.
 *
 * Concurrency: read-then-write was previously unserialised, so two
 * admins clicking at once resolved by statement ordering and both could
 * fire the side effects around the transition. Inside a transaction the
 * row is locked, making the check-and-set atomic.
 */
export async function transitionLead(
  opts: TransitionLeadOptions,
): Promise<LeadState> {
  const select = `SELECT "id", "leadState", "stage" FROM "ProjectBrief" WHERE "id" = $1${
    opts.client ? " FOR UPDATE" : ""
  }`;
  const brief = opts.client
    ? ((
        await opts.client.query<{
          id: string;
          leadState: string;
          stage: string;
        }>(select, [opts.briefId])
      ).rows[0] ?? null)
    : await queryOne<{ id: string; leadState: string; stage: string }>(select, [
        opts.briefId,
      ]);
  if (!brief) throw new LeadTransitionError("?", opts.to, "Brief not found");

  // Briefs predating leadState: infer from the legacy stage.
  const from: LeadState = isLeadState(brief.leadState)
    ? brief.leadState === "DRAFT" && brief.stage !== "INTAKE"
      ? inferLeadStateFromLegacyStage(brief.stage)
      : (brief.leadState as LeadState)
    : inferLeadStateFromLegacyStage(brief.stage);

  if (from === opts.to) return from; // idempotent no-op

  if (!canTransitionLead(from, opts.to)) {
    throw new LeadTransitionError(from, opts.to);
  }
  if (opts.to === "CANCELLED" && !opts.reason) {
    throw new LeadTransitionError(from, opts.to, "Cancellation requires a reason");
  }

  await updateRows(
    "ProjectBrief",
    { id: opts.briefId },
    {
      leadState: opts.to,
      stage: LEAD_STATE_TO_LEGACY_STAGE[opts.to],
    },
    { client: opts.client },
  );

  await auditTransition({
    actor: opts.actor,
    entityType: "ProjectBrief",
    entityId: opts.briefId,
    machine: "lead",
    from,
    to: opts.to,
    reason: opts.reason,
    meta: opts.meta,
    client: opts.client,
  });

  return opts.to;
}

/**
 * Opportunistic advance — the state-machine replacement for the old
 * `UPDATE "ProjectBrief" SET "stage" = … WHERE "stage" IN (…)` writes.
 *
 * Those conditional updates silently did nothing when the brief was
 * somewhere else in the pipeline; this preserves that behaviour while
 * keeping `transitionLead` the only writer:
 *
 *   - already at `to`, or past it  → no-op, returns the current state
 *   - the edge is legal            → transitions (and audits)
 *   - the edge is illegal          → no-op, returns the current state
 *
 * Use `transitionLead` directly when a caller *requires* the hop and
 * an illegal edge should surface as an error.
 */
export async function advanceLeadIfAllowed(
  opts: TransitionLeadOptions,
): Promise<LeadState | null> {
  // Read through the caller's client when present, otherwise this
  // wouldn't see writes made earlier in the same transaction.
  const from = await getLeadState(opts.briefId, opts.client);
  if (!from) return null;
  if (from === opts.to) return from;

  const fromIdx = progressIndex(from);
  const toIdx = progressIndex(opts.to);
  // Never walk the pipeline backwards.
  if (fromIdx >= 0 && toIdx >= 0 && toIdx <= fromIdx) return from;

  if (!canTransitionLead(from, opts.to)) return from;
  return transitionLead(opts);
}

/** Admin cancellation — reachable from any non-cancelled state. */
export async function cancelLead(opts: {
  briefId: string;
  actor: TransitionActor;
  reason: string;
}): Promise<void> {
  await transitionLead({
    briefId: opts.briefId,
    to: "CANCELLED",
    actor: opts.actor,
    reason: opts.reason,
  });
}

/** Read the effective lead state (handles pre-plan-A briefs). */
export async function getLeadState(
  briefId: string,
  client?: PoolClient,
): Promise<LeadState | null> {
  const text =
    'SELECT "leadState", "stage" FROM "ProjectBrief" WHERE "id" = $1';
  const brief = client
    ? ((await client.query<{ leadState: string; stage: string }>(text, [briefId]))
        .rows[0] ?? null)
    : await queryOne<{ leadState: string; stage: string }>(text, [briefId]);
  if (!brief) return null;
  if (isLeadState(brief.leadState)) {
    if (brief.leadState === "DRAFT" && brief.stage !== "INTAKE") {
      return inferLeadStateFromLegacyStage(brief.stage);
    }
    return brief.leadState as LeadState;
  }
  return inferLeadStateFromLegacyStage(brief.stage);
}
