/**
 * Structured decline reasons emitted by partners when they pass on a
 * brief. Used by:
 *   - The partner inbox decline UI (`<DeclineReasonDialog>`)
 *   - The admin "why declined?" analytics rollup
 *   - The Match.declineReason column (string allow-list)
 *
 * Naming convention: kebab-case stable identifiers. Adding a reason:
 *   append below and update `DECLINE_REASON_LABELS`. **Never rename.**
 *   Renames break historical analytics + DB constraints.
 */

import { z } from "zod";

export const DECLINE_REASONS = [
  "out-of-scope",
  "no-bandwidth",
  "no-fit-vertical",
  "no-fit-geography",
  "no-fit-tech",
  "budget-mismatch",
  "timeline-mismatch",
  "competitor-conflict",
  "internal-policy",
  "other",
] as const;

export const DeclineReason = z.enum(DECLINE_REASONS);
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Human-readable labels for each reason. UI imports these directly. */
export const DECLINE_REASON_LABELS: Record<DeclineReason, string> = {
  "out-of-scope": "Out of our scope",
  "no-bandwidth": "No bandwidth right now",
  "no-fit-vertical": "Not our vertical",
  "no-fit-geography": "Not our region",
  "no-fit-tech": "Tech stack isn't ours",
  "budget-mismatch": "Budget doesn't fit",
  "timeline-mismatch": "Timeline doesn't fit",
  "competitor-conflict": "Conflict of interest",
  "internal-policy": "Internal policy",
  "other": "Other (free text)",
};

/**
 * Win/loss reason taxonomy — captured by the customer when picking a
 * winner. Aggregated and surfaced back to *all* bidding partners as
 * anonymised intel ≥ 3 deals (S7 — win/loss feed).
 */
export const WIN_LOSS_REASONS = [
  "price",
  "timeline",
  "team",
  "approach",
  "experience",
  "chemistry",
  "references",
  "other",
] as const;

export const WinLossReason = z.enum(WIN_LOSS_REASONS);
export type WinLossReason = (typeof WIN_LOSS_REASONS)[number];

export const WIN_LOSS_REASON_LABELS: Record<WinLossReason, string> = {
  price: "Price / value",
  timeline: "Timeline",
  team: "Team quality",
  approach: "Approach / methodology",
  experience: "Industry experience",
  chemistry: "Chemistry / cultural fit",
  references: "References",
  other: "Other",
};
