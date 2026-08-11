/**
 * Identity-firewall test suite — plan-A §8 / §10 (BLOCKING).
 *
 * Asserts that partner-facing and company-facing serializer output
 * never contains identity fields pre-reveal, that the reveal gate
 * flips behaviour only for selected partners, and that
 * `assertFirewallSafe` catches forbidden fields at any depth.
 */

import { describe, it, expect } from "vitest";
import {
  assertFirewallSafe,
  FirewallViolationError,
  isPartnerRevealed,
  isRevealActive,
  serializeCompanyFacingProposal,
  serializePartnerFacingBrief,
} from "@/lib/serializers/firewall";

const fullBrief = {
  id: "brief_1",
  title: "BigQuery migration",
  anonymizedCompanySummary:
    "Manufacturing, 2,000 employees, head of data, open to resell",
  services: '["CONSULTING"]',
  executiveSummary: "Migrate the warehouse",
  scopeRequirements: "[]",
  successCriteria: "[]",
  milestones: "[]",
  budgetRange: "€100k–250k",
  preferredLocation: "EMEA",
  requiredCertifications: "[]",
  industryExperience: "[]",
  targetGoLive: "Q3",
  company: { name: "Acme GmbH", website: "https://acme.example" },
};

const fullProposalInput = {
  proposal: {
    id: "prop_1",
    summary: "We deliver.",
    approach: "Agile",
    timelineWeeks: 12,
    totalCost: 100_000_00,
    status: "QC_PASSED",
    strengths: '["Fast"]',
    teamComposition: '[{"role":"Architect","count":1}]',
    submittedAt: new Date("2026-07-01T10:00:00Z"),
  },
  match: { id: "match_1", placeholderLabel: "Partner B", status: "QC_PASSED" },
  partner: { name: "CloudCo BV", tagline: "GCP experts", tier: "PREMIER" },
  submissionRank: 2,
  fallbackIndex: 1,
};

describe("partner-facing brief serializer", () => {
  it("never exposes company identity pre-reveal", () => {
    const dto = serializePartnerFacingBrief(fullBrief, { revealed: false });
    expect(dto.companyName).toBeNull();
    expect(dto.companyWebsite).toBeNull();
    expect(JSON.stringify(dto)).not.toContain("Acme");
    expect(() => assertFirewallSafe(dto, "partner")).not.toThrow();
  });

  it("exposes company identity only when revealed", () => {
    const dto = serializePartnerFacingBrief(fullBrief, { revealed: true });
    expect(dto.companyName).toBe("Acme GmbH");
  });

  it("keeps the anonymized summary available pre-reveal", () => {
    const dto = serializePartnerFacingBrief(fullBrief, { revealed: false });
    expect(dto.anonymizedCompanySummary).toContain("Manufacturing");
  });
});

describe("company-facing proposal serializer", () => {
  it("uses the stable placeholder label pre-reveal", () => {
    const dto = serializeCompanyFacingProposal(fullProposalInput, {
      revealed: false,
    });
    expect(dto.displayLabel).toBe("Partner B");
    expect(dto.revealedPartnerName).toBeNull();
    expect(dto.revealedTagline).toBeNull();
    expect(JSON.stringify(dto)).not.toContain("CloudCo");
  });

  it("falls back to an index-derived label when none assigned", () => {
    const dto = serializeCompanyFacingProposal(
      {
        ...fullProposalInput,
        match: { id: "m", placeholderLabel: null, status: "" },
        fallbackIndex: 2,
      },
      { revealed: false },
    );
    expect(dto.displayLabel).toBe("Partner C");
  });

  it("reveals identity only when the reveal gate is open", () => {
    const dto = serializeCompanyFacingProposal(fullProposalInput, {
      revealed: true,
    });
    expect(dto.displayLabel).toBe("CloudCo BV");
    expect(dto.revealedPartnerName).toBe("CloudCo BV");
  });

  it("marks the first submission", () => {
    const dto = serializeCompanyFacingProposal(
      { ...fullProposalInput, submissionRank: 1 },
      { revealed: false },
    );
    expect(dto.submittedFirst).toBe(true);
  });
});

describe("reveal gate", () => {
  it("is closed for every pre-reveal lead state", () => {
    for (const state of [
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
      "CANCELLED",
      "STALLED",
    ]) {
      expect(isRevealActive(state)).toBe(false);
    }
  });

  it("opens at REVEAL_APPROVED and stays open downstream", () => {
    for (const state of [
      "REVEAL_APPROVED",
      "MEETINGS_SCHEDULED",
      "COMPLETED",
      "DROPPED_OFF",
    ]) {
      expect(isRevealActive(state)).toBe(true);
    }
  });

  it("never reveals a non-selected partner, even post-reveal", () => {
    expect(
      isPartnerRevealed({
        leadState: "REVEAL_APPROVED",
        matchStatus: "NOT_SELECTED",
      }),
    ).toBe(false);
    expect(
      isPartnerRevealed({
        leadState: "REVEAL_APPROVED",
        matchStatus: "QC_PASSED",
      }),
    ).toBe(false);
  });

  it("reveals a selected partner only after the reveal event", () => {
    expect(
      isPartnerRevealed({
        leadState: "COMPANY_SELECTED",
        matchStatus: "SELECTED",
      }),
    ).toBe(false);
    expect(
      isPartnerRevealed({
        leadState: "REVEAL_APPROVED",
        matchStatus: "SELECTED",
      }),
    ).toBe(true);
  });
});

describe("assertFirewallSafe", () => {
  it("catches forbidden company fields in partner payloads at depth", () => {
    expect(() =>
      assertFirewallSafe(
        { data: { nested: [{ customerEmail: "x@acme.example" }] } },
        "partner",
      ),
    ).toThrow(FirewallViolationError);
  });

  it("catches forbidden partner fields in company payloads", () => {
    expect(() =>
      assertFirewallSafe({ partnerName: "CloudCo" }, "company"),
    ).toThrow(FirewallViolationError);
  });

  it("catches company contractual data in partner payloads (admin-only, §10)", () => {
    expect(() =>
      assertFirewallSafe({ gcpDiscountPct: 12 }, "partner"),
    ).toThrow(FirewallViolationError);
  });

  it("ignores null/empty forbidden fields", () => {
    expect(() =>
      assertFirewallSafe({ partnerName: null, logoUrl: "" }, "company"),
    ).not.toThrow();
  });

  it("passes clean payloads", () => {
    const dto = serializeCompanyFacingProposal(fullProposalInput, {
      revealed: false,
    });
    expect(() => assertFirewallSafe(dto, "company")).not.toThrow();
  });
});
