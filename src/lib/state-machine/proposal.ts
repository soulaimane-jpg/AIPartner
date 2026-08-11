/**
 * Proposal status machine (partner side) — plan-A §5.3.
 *
 *   DRAFT → INTERNAL_REVIEW → INTERNALLY_APPROVED → SUBMITTED
 *         → IN_QC ⇄ CLARIFICATION_NEEDED → QC_PASSED
 *
 * P0 implements INTERNAL_REVIEW/INTERNALLY_APPROVED as a single
 * "mark approved" action recording the approver (M7.4). Legacy
 * statuses (SHORTLISTED, SELECTED, DECLINED) remain for the customer
 * selection flow downstream of QC_PASSED.
 */

import "server-only";
import { queryOne, updateRows } from "@/lib/db";
import { auditTransition, type TransitionActor } from "./transition";

export const PROPOSAL_STATES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "INTERNALLY_APPROVED",
  "SUBMITTED",
  "IN_QC",
  "CLARIFICATION_NEEDED",
  "QC_PASSED",
  // Legacy / downstream customer selection
  "SHORTLISTED",
  "SELECTED",
  "DECLINED",
] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

const PROPOSAL_TRANSITIONS: Partial<
  Record<ProposalState, readonly ProposalState[]>
> = {
  DRAFT: ["INTERNAL_REVIEW", "INTERNALLY_APPROVED", "SUBMITTED"],
  INTERNAL_REVIEW: ["INTERNALLY_APPROVED", "DRAFT"],
  INTERNALLY_APPROVED: ["SUBMITTED", "DRAFT"],
  SUBMITTED: ["IN_QC", "QC_PASSED"], // QC may pass directly for trivial cases — still an explicit admin event
  IN_QC: ["CLARIFICATION_NEEDED", "QC_PASSED"],
  CLARIFICATION_NEEDED: ["IN_QC", "SUBMITTED"],
  QC_PASSED: ["SELECTED", "DECLINED", "SHORTLISTED"],
  SHORTLISTED: ["SELECTED", "DECLINED"],
  SELECTED: [],
  DECLINED: [],
};

export function isProposalState(value: string): value is ProposalState {
  return (PROPOSAL_STATES as readonly string[]).includes(value);
}

export function canTransitionProposal(
  from: ProposalState,
  to: ProposalState,
): boolean {
  return PROPOSAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export class ProposalTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    reason?: string,
  ) {
    super(
      reason ??
        `Illegal proposal transition ${from} → ${to} (see plan-A §5.3)`,
    );
    this.name = "ProposalTransitionError";
  }
}

export interface TransitionProposalOptions {
  proposalId: string;
  to: ProposalState;
  actor: TransitionActor;
  reason?: string;
  meta?: Record<string, unknown>;
  /** Extra Proposal columns to set atomically with the status write. */
  data?: Record<string, unknown>;
}

export async function transitionProposal(
  opts: TransitionProposalOptions,
): Promise<ProposalState> {
  const proposal = await queryOne<{ id: string; status: string }>(
    'SELECT "id", "status" FROM "Proposal" WHERE "id" = $1',
    [opts.proposalId],
  );
  if (!proposal) {
    throw new ProposalTransitionError("?", opts.to, "Proposal not found");
  }

  const from = (
    isProposalState(proposal.status) ? proposal.status : "DRAFT"
  ) as ProposalState;

  if (from === opts.to) return from;

  if (!canTransitionProposal(from, opts.to)) {
    throw new ProposalTransitionError(from, opts.to);
  }

  await updateRows(
    "Proposal",
    { id: opts.proposalId },
    { status: opts.to, ...(opts.data ?? {}) },
  );

  await auditTransition({
    actor: opts.actor,
    entityType: "Proposal",
    entityId: opts.proposalId,
    machine: "proposal",
    from,
    to: opts.to,
    reason: opts.reason,
    meta: opts.meta,
  });

  return opts.to;
}
