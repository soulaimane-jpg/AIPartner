/**
 * State-machine transition tests — plan-A §5 (every table row).
 * Pure guard-level tests; DB-backed executor behaviour is covered by
 * the integration tier.
 */

import { describe, it, expect } from "vitest";
import {
  canTransitionLead,
  LEAD_STATES,
  LEAD_STATE_TO_LEGACY_STAGE,
  inferLeadStateFromLegacyStage,
  type LeadState,
} from "@/lib/state-machine/lead";
import { canTransitionInvite } from "@/lib/state-machine/invite";
import { canTransitionProposal } from "@/lib/state-machine/proposal";

describe("lead lifecycle (§5.1)", () => {
  const allowed: Array<[LeadState, LeadState]> = [
    ["DRAFT", "SUBMITTED"],
    ["SUBMITTED", "IN_TRIAGE"],
    ["IN_TRIAGE", "CLARIFICATION_NEEDED"],
    ["CLARIFICATION_NEEDED", "IN_TRIAGE"],
    ["IN_TRIAGE", "LEAD_APPROVED"],
    ["LEAD_APPROVED", "PARTNERS_SELECTED"],
    ["PARTNERS_SELECTED", "SENT_TO_PARTNERS"],
    ["SENT_TO_PARTNERS", "PROPOSALS_IN_REVIEW"],
    ["SENT_TO_PARTNERS", "STALLED"],
    ["PROPOSALS_IN_REVIEW", "COMPARISON_RELEASED"],
    ["COMPARISON_RELEASED", "COMPANY_SELECTED"],
    ["COMPANY_SELECTED", "REVEAL_APPROVED"],
    ["REVEAL_APPROVED", "MEETINGS_SCHEDULED"],
    ["MEETINGS_SCHEDULED", "COMPLETED"],
    ["MEETINGS_SCHEDULED", "DROPPED_OFF"],
    ["DROPPED_OFF", "COMPLETED"],
    ["STALLED", "PARTNERS_SELECTED"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransitionLead(from, to)).toBe(true);
  });

  it("allows CANCELLED from any state except CANCELLED", () => {
    for (const from of LEAD_STATES) {
      expect(canTransitionLead(from, "CANCELLED")).toBe(from !== "CANCELLED");
    }
  });

  const denied: Array<[LeadState, LeadState]> = [
    ["DRAFT", "SENT_TO_PARTNERS"], // cannot skip triage
    ["DRAFT", "LEAD_APPROVED"],
    ["SUBMITTED", "LEAD_APPROVED"], // must pass through triage
    ["IN_TRIAGE", "PARTNERS_SELECTED"], // approval gate first
    ["LEAD_APPROVED", "SENT_TO_PARTNERS"], // partners must be selected first
    ["SENT_TO_PARTNERS", "COMPARISON_RELEASED"], // proposals first
    ["PROPOSALS_IN_REVIEW", "COMPANY_SELECTED"], // release gate first
    ["COMPARISON_RELEASED", "REVEAL_APPROVED"], // selection first (2 distinct actions)
    ["COMPANY_SELECTED", "MEETINGS_SCHEDULED"], // reveal gate first
    ["COMPLETED", "DRAFT"],
    ["CANCELLED", "SUBMITTED"],
  ];

  it.each(denied)("denies %s → %s", (from, to) => {
    expect(canTransitionLead(from, to)).toBe(false);
  });

  it("maps every state to a legacy stage", () => {
    for (const state of LEAD_STATES) {
      expect(LEAD_STATE_TO_LEGACY_STAGE[state]).toBeTruthy();
    }
  });

  it("infers sensible states from legacy stages", () => {
    expect(inferLeadStateFromLegacyStage("INTAKE")).toBe("DRAFT");
    expect(inferLeadStateFromLegacyStage("PROPOSALS")).toBe("PROPOSALS_IN_REVIEW");
    expect(inferLeadStateFromLegacyStage("CLOSED")).toBe("COMPLETED");
  });
});

describe("invite lifecycle (§5.2)", () => {
  const allowed: Array<[string, string]> = [
    ["INVITED", "PARTNER_ACCEPTED"],
    ["INVITED", "PARTNER_DECLINED"],
    ["INVITED", "EXPIRED"],
    ["INVITED", "WITHDRAWN"],
    ["PARTNER_ACCEPTED", "EXTENSION_REQUESTED"],
    ["PARTNER_ACCEPTED", "PROPOSAL_SUBMITTED"],
    ["PARTNER_ACCEPTED", "PROPOSAL_EXPIRED"],
    ["EXTENSION_REQUESTED", "PARTNER_ACCEPTED"], // grant or deny → back to accepted
    ["PROPOSAL_EXPIRED", "PARTNER_ACCEPTED"], // admin re-open
    ["EXPIRED", "INVITED"], // admin re-invite
    ["PROPOSAL_SUBMITTED", "QC_PASSED"],
    ["QC_PASSED", "SELECTED"],
    ["QC_PASSED", "NOT_SELECTED"],
    ["PARTNER_DECLINED", "INVITED"],
    ["SOURCED", "INVITED"], // legacy on-ramp
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransitionInvite(from as never, to as never)).toBe(true);
  });

  const denied: Array<[string, string]> = [
    ["INVITED", "PROPOSAL_SUBMITTED"], // must accept first
    ["INVITED", "QC_PASSED"],
    ["PARTNER_ACCEPTED", "SELECTED"], // must submit + QC first
    ["PROPOSAL_SUBMITTED", "SELECTED"], // QC gate first
    ["SELECTED", "NOT_SELECTED"], // terminal
    ["NOT_SELECTED", "SELECTED"], // terminal — firewalled forever
    ["WITHDRAWN", "INVITED"], // terminal
    ["EXPIRED", "PARTNER_ACCEPTED"], // must be re-invited first
  ];

  it.each(denied)("denies %s → %s", (from, to) => {
    expect(canTransitionInvite(from as never, to as never)).toBe(false);
  });
});

describe("proposal lifecycle (§5.3)", () => {
  const allowed: Array<[string, string]> = [
    ["DRAFT", "INTERNAL_REVIEW"],
    ["DRAFT", "INTERNALLY_APPROVED"], // P0 single "mark approved" action
    ["DRAFT", "SUBMITTED"], // direct submit without internal approval
    ["INTERNAL_REVIEW", "INTERNALLY_APPROVED"],
    ["INTERNALLY_APPROVED", "SUBMITTED"],
    ["SUBMITTED", "IN_QC"],
    ["IN_QC", "CLARIFICATION_NEEDED"],
    ["CLARIFICATION_NEEDED", "IN_QC"],
    ["IN_QC", "QC_PASSED"],
    ["QC_PASSED", "SELECTED"],
    ["QC_PASSED", "DECLINED"],
  ];

  it.each(allowed)("allows %s → %s", (from, to) => {
    expect(canTransitionProposal(from as never, to as never)).toBe(true);
  });

  const denied: Array<[string, string]> = [
    ["INTERNAL_REVIEW", "SUBMITTED"],
    ["SUBMITTED", "SELECTED"], // QC first
    ["CLARIFICATION_NEEDED", "QC_PASSED"], // must return to QC
    ["SELECTED", "DRAFT"],
  ];

  it.each(denied)("denies %s → %s", (from, to) => {
    expect(canTransitionProposal(from as never, to as never)).toBe(false);
  });
});
