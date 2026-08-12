/**
 * LeadPartnerInvite lifecycle — plan-A §5.2. Lives on `Match.status`.
 *
 * Extends the legacy status set (SOURCED, INVITED, PARTNER_ACCEPTED,
 * PARTNER_DECLINED, REVIEW_APPROVED, SHORTLISTED, IN_FINAL_THREE,
 * DECLINED, WITHDRAWN) with the plan-A invite states. Legacy values
 * remain readable; new flows write the new states.
 *
 *   INVITED ─► PARTNER_ACCEPTED ─► PROPOSAL_SUBMITTED ─► QC_PASSED ─► SELECTED
 *                    ▲                    │ (partner withdraws pre-QC)
 *                    └────────────────────┘
 *      │             │                                        └────► NOT_SELECTED
 *      │             ├─► EXTENSION_REQUESTED ─► PARTNER_ACCEPTED (grant/deny)
 *      │             └─► PROPOSAL_EXPIRED (T2)
 *      ├─► PARTNER_DECLINED (reason captured)
 *      ├─► EXPIRED (T1)
 *      └─► WITHDRAWN (admin)
 */

import "server-only";
import { queryOne, updateRows } from "@/lib/db";
import { auditTransition, type TransitionActor } from "./transition";

export const INVITE_STATES = [
  // Legacy (pre-invite pipeline)
  "SOURCED",
  "REVIEW_APPROVED",
  "SHORTLISTED",
  "IN_FINAL_THREE",
  "DECLINED",
  // plan-A §5.2
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
export type InviteState = (typeof INVITE_STATES)[number];

const INVITE_TRANSITIONS: Partial<Record<InviteState, readonly InviteState[]>> = {
  // Legacy on-ramp: SOURCED rows can enter the plan-A pipeline.
  SOURCED: ["INVITED", "PARTNER_ACCEPTED", "PARTNER_DECLINED", "WITHDRAWN"],
  INVITED: ["PARTNER_ACCEPTED", "PARTNER_DECLINED", "EXPIRED", "WITHDRAWN"],
  PARTNER_ACCEPTED: [
    "EXTENSION_REQUESTED",
    "PROPOSAL_SUBMITTED",
    "PROPOSAL_EXPIRED",
    "WITHDRAWN",
  ],
  EXTENSION_REQUESTED: ["PARTNER_ACCEPTED", "PROPOSAL_EXPIRED", "WITHDRAWN"],
  // Admin may re-open an expired invite (audit-logged) → back to accepted.
  PROPOSAL_EXPIRED: ["PARTNER_ACCEPTED", "WITHDRAWN"],
  EXPIRED: ["INVITED", "WITHDRAWN"], // admin re-invite
  // PARTNER_ACCEPTED = the partner withdrew their proposal before QC
  // and is back inside their (unchanged) T2 window.
  PROPOSAL_SUBMITTED: ["QC_PASSED", "WITHDRAWN", "PARTNER_ACCEPTED"],
  QC_PASSED: ["SELECTED", "NOT_SELECTED", "WITHDRAWN"],
  SELECTED: [],
  NOT_SELECTED: [],
  PARTNER_DECLINED: ["INVITED"], // admin re-invite after decline
  WITHDRAWN: [],
  // Legacy terminal-ish states — allow migration into the new pipeline.
  REVIEW_APPROVED: ["INVITED", "PROPOSAL_SUBMITTED", "WITHDRAWN"],
  SHORTLISTED: ["QC_PASSED", "SELECTED", "NOT_SELECTED", "WITHDRAWN"],
  IN_FINAL_THREE: ["SELECTED", "NOT_SELECTED", "WITHDRAWN"],
  DECLINED: ["INVITED"],
};

export function isInviteState(value: string): value is InviteState {
  return (INVITE_STATES as readonly string[]).includes(value);
}

export function canTransitionInvite(
  from: InviteState,
  to: InviteState,
): boolean {
  return INVITE_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InviteTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    reason?: string,
  ) {
    super(
      reason ??
        `Illegal invite transition ${from} → ${to} (see plan-A §5.2)`,
    );
    this.name = "InviteTransitionError";
  }
}

export interface TransitionInviteOptions {
  matchId: string;
  to: InviteState;
  actor: TransitionActor;
  reason?: string;
  meta?: Record<string, unknown>;
  /** Extra Match columns to set atomically with the status write. */
  data?: Record<string, unknown>;
}

export async function transitionInvite(
  opts: TransitionInviteOptions,
): Promise<InviteState> {
  const match = await queryOne<{ id: string; status: string }>(
    'SELECT "id", "status" FROM "Match" WHERE "id" = $1',
    [opts.matchId],
  );
  if (!match) throw new InviteTransitionError("?", opts.to, "Match not found");

  const from = (
    isInviteState(match.status) ? match.status : "SOURCED"
  ) as InviteState;

  if (from === opts.to) return from; // idempotent

  if (!canTransitionInvite(from, opts.to)) {
    throw new InviteTransitionError(from, opts.to);
  }

  await updateRows(
    "Match",
    { id: opts.matchId },
    { status: opts.to, ...(opts.data ?? {}) },
  );

  await auditTransition({
    actor: opts.actor,
    entityType: "Match",
    entityId: opts.matchId,
    machine: "invite",
    from,
    to: opts.to,
    reason: opts.reason,
    meta: opts.meta,
  });

  return opts.to;
}
