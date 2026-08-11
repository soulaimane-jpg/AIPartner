import { describe, expect, it } from "vitest";
import {
  getPartnerPipelinePhase,
  getPartnerStatusLabel,
  getPartnerWorkspaceBucket,
  isPartnerActionRequired,
} from "@/lib/partner-workflow";

describe("partner workspace classification", () => {
  it.each([
    ["SOURCED", null],
    ["INVITED", null],
    ["REVIEW_APPROVED", null],
  ])("places %s without a proposal in opportunities", (matchStatus, proposalStatus) => {
    expect(getPartnerWorkspaceBucket(matchStatus, proposalStatus)).toBe("opportunities");
  });

  it.each([
    ["PARTNER_ACCEPTED", null],
    ["EXTENSION_REQUESTED", "DRAFT"],
    ["PROPOSAL_SUBMITTED", "SUBMITTED"],
    ["QC_PASSED", "QC_PASSED"],
    ["SHORTLISTED", "SHORTLISTED"],
    ["IN_FINAL_THREE", "SHORTLISTED"],
  ])("places %s / %s in pipeline", (matchStatus, proposalStatus) => {
    expect(getPartnerWorkspaceBucket(matchStatus, proposalStatus)).toBe("pipeline");
  });

  it.each([
    ["SELECTED", "QC_PASSED"],
    ["QC_PASSED", "SELECTED"],
  ])("places selected records in won", (matchStatus, proposalStatus) => {
    expect(getPartnerWorkspaceBucket(matchStatus, proposalStatus)).toBe("won");
  });

  it.each([
    ["PARTNER_DECLINED", null],
    ["EXPIRED", null],
    ["PROPOSAL_EXPIRED", "DRAFT"],
    ["NOT_SELECTED", "DECLINED"],
    ["WITHDRAWN", null],
  ])("places terminal record %s / %s in closed", (matchStatus, proposalStatus) => {
    expect(getPartnerWorkspaceBucket(matchStatus, proposalStatus)).toBe("closed");
  });
});

describe("partner pipeline phases", () => {
  it("keeps accepted and draft work in proposal", () => {
    expect(getPartnerPipelinePhase("PARTNER_ACCEPTED", "DRAFT")).toBe("proposal");
    expect(getPartnerPipelinePhase("PARTNER_ACCEPTED", "CLARIFICATION_NEEDED")).toBe("proposal");
  });

  it("puts submitted and QC work in review", () => {
    expect(getPartnerPipelinePhase("PROPOSAL_SUBMITTED", "SUBMITTED")).toBe("review");
    expect(getPartnerPipelinePhase("QC_PASSED", "QC_PASSED")).toBe("review");
  });

  it("puts shortlist states in finalist", () => {
    expect(getPartnerPipelinePhase("SHORTLISTED", "SHORTLISTED")).toBe("finalist");
    expect(getPartnerPipelinePhase("IN_FINAL_THREE", "QC_PASSED")).toBe("finalist");
  });
});

describe("partner action and status copy", () => {
  it("marks only partner-owned steps as requiring action", () => {
    expect(isPartnerActionRequired("INVITED", null)).toBe(true);
    expect(isPartnerActionRequired("PARTNER_ACCEPTED", "DRAFT")).toBe(true);
    expect(isPartnerActionRequired("PROPOSAL_SUBMITTED", "SUBMITTED")).toBe(false);
  });

  it("uses clear labels for current workflow states", () => {
    expect(getPartnerStatusLabel("INVITED", null)).toBe("Response needed");
    expect(getPartnerStatusLabel("PARTNER_ACCEPTED", "CLARIFICATION_NEEDED")).toBe("Changes requested");
    expect(getPartnerStatusLabel("SELECTED", "QC_PASSED")).toBe("Selected");
  });
});
