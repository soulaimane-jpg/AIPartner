/**
 * Canonical section registry invariants (plan-A §6.3/§6.7) +
 * legacy-brief mapping. These keys are persisted — renames would
 * corrupt data, so the tests pin them.
 */

import { describe, it, expect } from "vitest";
import {
  BRIEF_SECTION_KEYS,
  BRIEF_SECTIONS,
  PROPOSAL_SECTION_KEYS,
  PROPOSAL_SECTIONS,
  mandatoryBriefKeys,
  mandatoryProposalKeys,
  legacyBriefToSections,
  isBriefSectionKey,
  isProposalSectionKey,
} from "@/lib/sections";

describe("brief section registry", () => {
  it("pins the persisted keys", () => {
    expect([...BRIEF_SECTION_KEYS]).toEqual([
      "context_and_goals",
      "scope",
      "current_environment",
      "technical_requirements",
      "timeline",
      "budget_band",
      "resell_interest",
      "success_criteria",
      "constraints",
      "other",
    ]);
  });

  it("has unique ranks and matching key fields", () => {
    const ranks = BRIEF_SECTION_KEYS.map((k) => BRIEF_SECTIONS[k].rank);
    expect(new Set(ranks).size).toBe(ranks.length);
    for (const key of BRIEF_SECTION_KEYS) {
      expect(BRIEF_SECTIONS[key].key).toBe(key);
    }
  });

  it("marks the M3.6 mandatory set", () => {
    expect(mandatoryBriefKeys()).toEqual([
      "context_and_goals",
      "scope",
      "current_environment",
      "technical_requirements",
      "timeline",
      "success_criteria",
    ]);
  });

  it("type-guards keys", () => {
    expect(isBriefSectionKey("scope")).toBe(true);
    expect(isBriefSectionKey("nonsense")).toBe(false);
  });
});

describe("proposal section registry", () => {
  it("pins the persisted keys", () => {
    expect([...PROPOSAL_SECTION_KEYS]).toEqual([
      "approach",
      "scope_response",
      "timeline",
      "resources_team",
      "pricing",
      "assumptions",
      "references_anonymizable",
      "questions",
    ]);
  });

  it("marks the M7.1 mandatory set", () => {
    expect(mandatoryProposalKeys()).toEqual([
      "approach",
      "scope_response",
      "timeline",
      "resources_team",
      "pricing",
      "assumptions",
    ]);
  });

  it("has unique ranks", () => {
    const ranks = PROPOSAL_SECTION_KEYS.map((k) => PROPOSAL_SECTIONS[k].rank);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(isProposalSectionKey("pricing")).toBe(true);
  });
});

describe("legacyBriefToSections", () => {
  it("maps populated legacy columns onto canonical keys", () => {
    const out = legacyBriefToSections({
      executiveSummary: "Fix the reporting bottleneck.",
      scopeRequirements: JSON.stringify([
        { title: "Warehouse", detail: "Migrate to BigQuery" },
      ]),
      dataSources: JSON.stringify([{ name: "Postgres", detail: "OLTP" }]),
      targetGoLive: "Q3 2026",
      budgetRange: "€100k–250k",
      successCriteria: JSON.stringify([{ metric: "Latency", target: "<2s" }]),
      procurement: "VIA_RESELLER",
    });
    expect(out.context_and_goals).toContain("reporting bottleneck");
    expect(out.scope).toContain("BigQuery");
    expect(out.current_environment).toContain("Postgres");
    expect(out.timeline).toContain("Q3 2026");
    expect(out.budget_band).toContain("€100k");
    expect(out.success_criteria).toContain("Latency");
    expect(out.resell_interest).toContain("reseller");
  });

  it("omits empty sections and tolerates malformed JSON", () => {
    const out = legacyBriefToSections({
      scopeRequirements: "not-json-at-all",
    });
    expect(out.scope).toBe("not-json-at-all"); // raw fallback
    expect(out.context_and_goals).toBeUndefined();
    expect(out.budget_band).toBeUndefined();
  });
});
