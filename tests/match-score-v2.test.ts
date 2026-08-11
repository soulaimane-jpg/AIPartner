import { describe, it, expect } from "vitest";
import {
  computeMatchV2,
  deriveSubstantiatedTagIds,
  DEFAULT_WEIGHTS,
  type BriefRequirements,
  type PartnerCapabilities,
} from "@/lib/match-score-v2";

const NOW = new Date("2026-08-09T00:00:00Z");
const RECENT = new Date("2026-07-01T00:00:00Z");

function brief(over: Partial<BriefRequirements> = {}): BriefRequirements {
  return {
    workloadTagIds: [],
    verticalTagIds: [],
    specializationTagIds: [],
    complianceTagIds: [],
    productTagIds: [],
    budgetBand: null,
    urgency: null,
    ...over,
  };
}

function partner(over: Partial<PartnerCapabilities> = {}): PartnerCapabilities {
  return {
    workloadTagIds: [],
    verticalTagIds: [],
    specializationTagIds: [],
    complianceTagIds: [],
    productTagIds: [],
    minDealSize: null,
    benchAvailability: null,
    substantiatedTagIds: [],
    profileStrength: 100,
    lastVerifiedAt: RECENT,
    ...over,
  };
}

describe("weights", () => {
  it("sum to 1 so the score stays a percentage", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("weight workloads above every other facet", () => {
    // Workloads describe the actual work; everything else is context.
    for (const [key, value] of Object.entries(DEFAULT_WEIGHTS)) {
      if (key === "workloads") continue;
      expect(DEFAULT_WEIGHTS.workloads).toBeGreaterThan(value);
    }
  });
});

describe("substantiation", () => {
  it("scores an evidenced match above a bare claim", () => {
    const b = brief({ workloadTagIds: ["w1", "w2"] });

    const evidenced = computeMatchV2(
      b,
      partner({ workloadTagIds: ["w1", "w2"], substantiatedTagIds: ["w1", "w2"] }),
      { now: NOW },
    );
    const claimedOnly = computeMatchV2(
      b,
      partner({ workloadTagIds: ["w1", "w2"] }),
      { now: NOW },
    );

    expect(evidenced.score).toBeGreaterThan(claimedOnly.score);
    expect(evidenced.components.workloads.score).toBe(100);
    expect(claimedOnly.components.workloads.score).toBe(55);
  });

  it("stops a partner claiming everything from beating a focused specialist", () => {
    // The central worry about this whole design. A partner who ticks every box
    // with no evidence must not outrank one who has actually delivered.
    const b = brief({ workloadTagIds: ["w1", "w2"] });

    const claimsEverything = computeMatchV2(
      b,
      partner({
        workloadTagIds: ["w1", "w2", "w3", "w4", "w5", "w6"],
        verticalTagIds: ["v1", "v2", "v3", "v4"],
        productTagIds: ["p1", "p2", "p3", "p4", "p5"],
      }),
      { now: NOW },
    );
    const focusedSpecialist = computeMatchV2(
      b,
      partner({
        workloadTagIds: ["w1", "w2"],
        substantiatedTagIds: ["w1", "w2"],
      }),
      { now: NOW },
    );

    expect(focusedSpecialist.score).toBeGreaterThan(claimsEverything.score);
  });

  it("reports substantiated and claimed matches separately", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1", "w2", "w3"] }),
      partner({
        workloadTagIds: ["w1", "w2"],
        substantiatedTagIds: ["w1"],
      }),
      { now: NOW },
    );
    expect(result.components.workloads.matchedSubstantiated).toEqual(["w1"]);
    expect(result.components.workloads.matchedClaimed).toEqual(["w2"]);
    expect(result.components.workloads.missing).toEqual(["w3"]);
  });
});

describe("hard gates", () => {
  it("gates a project below the partner's minimum deal size", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], budgetBand: "under_25k" }),
      partner({ workloadTagIds: ["w1"], minDealSize: "over_100k" }),
      { now: NOW },
    );
    expect(result.eligible).toBe(false);
    expect(result.gates).toContain("budget_below_minimum");
  });

  it("allows a budget at or above the partner's floor", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], budgetBand: "50k_100k" }),
      partner({ workloadTagIds: ["w1"], minDealSize: "25k_50k" }),
      { now: NOW },
    );
    expect(result.eligible).toBe(true);
    expect(result.gates).toHaveLength(0);
  });

  it("gates a partner who cannot start in time", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], urgency: "immediate" }),
      partner({ workloadTagIds: ["w1"], benchAvailability: "1_month_plus" }),
      { now: NOW },
    );
    expect(result.gates).toContain("cannot_start_in_time");
  });

  it("allows a partner who can start sooner than required", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], urgency: "2_4_weeks" }),
      partner({ workloadTagIds: ["w1"], benchAvailability: "immediate" }),
      { now: NOW },
    );
    expect(result.eligible).toBe(true);
  });

  it("treats missing compliance as disqualifying, not merely weak", () => {
    // Regulatory requirements are binary. A partner who has never delivered
    // under HIPAA is not a lower-scoring HIPAA option.
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], complianceTagIds: ["hipaa"] }),
      partner({ workloadTagIds: ["w1"], substantiatedTagIds: ["w1"] }),
      { now: NOW },
    );
    expect(result.eligible).toBe(false);
    expect(result.gates).toContain("missing_required_compliance");
  });

  it("passes compliance when every requirement is held", () => {
    const result = computeMatchV2(
      brief({ complianceTagIds: ["hipaa", "soc2"] }),
      partner({ complianceTagIds: ["hipaa", "soc2", "gdpr"] }),
      { now: NOW },
    );
    expect(result.eligible).toBe(true);
  });

  it("does not gate when the brief states no constraints", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"] }),
      partner({ workloadTagIds: ["w1"], minDealSize: "over_100k" }),
      { now: NOW },
    );
    expect(result.eligible).toBe(true);
  });

  it("still produces a score for a gated partner", () => {
    // The score is what ranks them; the gate is what explains the block.
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"], budgetBand: "under_25k" }),
      partner({
        workloadTagIds: ["w1"],
        substantiatedTagIds: ["w1"],
        minDealSize: "over_100k",
      }),
      { now: NOW },
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.eligible).toBe(false);
  });
});

describe("freshness penalty", () => {
  it("penalises a never-verified profile", () => {
    const b = brief({ workloadTagIds: ["w1"] });
    const fresh = computeMatchV2(
      b,
      partner({ workloadTagIds: ["w1"], lastVerifiedAt: RECENT }),
      { now: NOW },
    );
    const never = computeMatchV2(
      b,
      partner({ workloadTagIds: ["w1"], lastVerifiedAt: null }),
      { now: NOW },
    );
    expect(never.score).toBeLessThan(fresh.score);
    expect(never.reasons).toContain("Profile not yet verified");
  });

  it("penalises progressively with age", () => {
    const b = brief({ workloadTagIds: ["w1"] });
    const mk = (daysAgo: number) =>
      computeMatchV2(
        b,
        partner({
          workloadTagIds: ["w1"],
          lastVerifiedAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
        }),
        { now: NOW },
      ).score;

    const recent = mk(30);
    const stale = mk(200);
    const ancient = mk(400);

    expect(stale).toBeLessThan(recent);
    expect(ancient).toBeLessThan(stale);
  });
});

describe("scoring shape", () => {
  it("stays within 0-100", () => {
    const perfect = computeMatchV2(
      brief({
        workloadTagIds: ["w1"],
        verticalTagIds: ["v1"],
        specializationTagIds: ["s1"],
        complianceTagIds: ["c1"],
        productTagIds: ["p1"],
        budgetBand: "over_100k",
        urgency: "1_month_plus",
      }),
      partner({
        workloadTagIds: ["w1"],
        verticalTagIds: ["v1"],
        specializationTagIds: ["s1"],
        complianceTagIds: ["c1"],
        productTagIds: ["p1"],
        substantiatedTagIds: ["w1", "v1", "s1", "c1", "p1"],
        minDealSize: "under_25k",
        benchAvailability: "immediate",
      }),
      { now: NOW },
    );
    expect(perfect.score).toBeGreaterThanOrEqual(95);
    expect(perfect.score).toBeLessThanOrEqual(100);
    expect(perfect.label).toBe("Excellent");

    const nothing = computeMatchV2(
      brief({ workloadTagIds: ["w1"], verticalTagIds: ["v1"] }),
      partner({ lastVerifiedAt: null }),
      { now: NOW },
    );
    expect(nothing.score).toBeGreaterThanOrEqual(0);
    expect(nothing.label).toBe("Poor");
  });

  it("gives partial credit when a facet is unspecified but the partner has depth", () => {
    const result = computeMatchV2(
      brief({ workloadTagIds: ["w1"] }),
      partner({ workloadTagIds: ["w1"], verticalTagIds: ["v1", "v2"] }),
      { now: NOW },
    );
    // Capped, because we are guessing rather than matching.
    expect(result.components.verticals.score).toBe(45);
  });

  it("scores a facet at zero when the partner has nothing there", () => {
    const result = computeMatchV2(
      brief(),
      partner({ workloadTagIds: [] }),
      { now: NOW },
    );
    expect(result.components.workloads.score).toBe(0);
  });
});

describe("deriveSubstantiatedTagIds", () => {
  const tags = [
    { id: "t_finops", label: "FinOps & Cost Optimization" },
    { id: "t_sap", label: "SAP" },
    { id: "t_migration", label: "Cloud Migration" },
    { id: "t_gaming", label: "Gaming" },
  ];

  it("matches a tag named in case-study text", () => {
    const result = deriveSubstantiatedTagIds(tags, [
      "Cut cloud costs 38% through a FinOps cost optimization programme.",
    ]);
    expect(result).toContain("t_finops");
  });

  it("matches multi-word labels whose words all appear", () => {
    const result = deriveSubstantiatedTagIds(tags, [
      "Delivered a large cloud data-centre migration for a retail client.",
    ]);
    expect(result).toContain("t_migration");
  });

  it("requires word boundaries for short labels", () => {
    // "SAP" must not match inside "sapphire" — that would turn a coincidence
    // into fabricated evidence.
    expect(deriveSubstantiatedTagIds(tags, ["Project Sapphire delivery"])).not.toContain(
      "t_sap",
    );
    expect(
      deriveSubstantiatedTagIds(tags, ["Migrated their SAP estate to GCP"]),
    ).toContain("t_sap");
  });

  it("returns nothing when there is no evidence at all", () => {
    expect(deriveSubstantiatedTagIds(tags, [])).toEqual([]);
    expect(deriveSubstantiatedTagIds(tags, ["", "   "])).toEqual([]);
  });

  it("does not substantiate unmentioned tags", () => {
    const result = deriveSubstantiatedTagIds(tags, [
      "A FinOps cost optimization engagement.",
    ]);
    expect(result).not.toContain("t_gaming");
    expect(result).not.toContain("t_sap");
  });
});
