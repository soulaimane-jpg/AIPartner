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
import { queryOne, updateRows } from "@/lib/db";
import { auditTransition, type TransitionActor } from "./transition";

export const LEAD_STATES = [
  "DRAFT",
  "SUBMITTED",
  "IN_TRIAGE",
  "CLARIFICATION_NEEDED",
  "LEAD_APPROVED",
  "PARTNERS_SELECTED",
  "SENT_TO_PARTNERS",
  "PROPOSALS_IN_REVIEW",
  "COMPARISON_RELEASED",
  "COMPANY_SELECTED",
  "REVEAL_APPROVED",
  "MEETINGS_SCHEDULED",
  "COMPLETED",
  "DROPPED_OFF",
  "CANCELLED",
  "STALLED",
] as const;
export type LeadState = (typeof LEAD_STATES)[number];

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
}

/**
 * Execute a guarded lead transition. Throws `LeadTransitionError` on
 * an illegal edge. Returns the new state.
 */
export async function transitionLead(
  opts: TransitionLeadOptions,
): Promise<LeadState> {
  const brief = await queryOne<{ id: string; leadState: string; stage: string }>(
    'SELECT "id", "leadState", "stage" FROM "ProjectBrief" WHERE "id" = $1',
    [opts.briefId],
  );
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
  });

  return opts.to;
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
export async function getLeadState(briefId: string): Promise<LeadState | null> {
  const brief = await queryOne<{ leadState: string; stage: string }>(
    'SELECT "leadState", "stage" FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!brief) return null;
  if (isLeadState(brief.leadState)) {
    if (brief.leadState === "DRAFT" && brief.stage !== "INTAKE") {
      return inferLeadStateFromLegacyStage(brief.stage);
    }
    return brief.leadState as LeadState;
  }
  return inferLeadStateFromLegacyStage(brief.stage);
}
