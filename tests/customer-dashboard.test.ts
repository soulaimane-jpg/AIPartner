import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCustomerDashboardAnalytics,
  type DashboardActivityPoint,
  type DashboardStageMetric,
} from "../src/lib/customer-dashboard";

const dashboardPage = readFileSync(resolve(process.cwd(), "src/app/(portal)/dashboard/page.tsx"), "utf8");

const now = new Date("2026-08-11T12:00:00.000Z");

describe("customer dashboard analytics", () => {
  it("returns stable zero-value metrics for a new customer", () => {
    const result = buildCustomerDashboardAnalytics({ briefs: [], proposals: [], now });

    expect(result.kpis).toEqual({
      activeBriefs: 0,
      averageReadiness: 0,
      proposalsReceived: 0,
      decisionsDue: 0,
    });
    expect(result.activity).toHaveLength(6);
    expect(result.activity.every((point: DashboardActivityPoint) => point.total === 0)).toBe(true);
    expect(result.stageDistribution.every((stage: DashboardStageMetric) => stage.count === 0)).toBe(true);
  });

  it("fills a continuous six-month activity series across year boundaries", () => {
    const result = buildCustomerDashboardAnalytics({
      now: new Date("2026-02-14T00:00:00.000Z"),
      briefs: [
        brief({ createdAt: "2025-10-04T10:00:00.000Z" }),
        brief({ createdAt: "2026-02-01T10:00:00.000Z" }),
      ],
      proposals: [
        { submittedAt: "2026-01-18T10:00:00.000Z" },
        { submittedAt: "2024-01-18T10:00:00.000Z" },
      ],
    });

    expect(result.activity.map((point: DashboardActivityPoint) => point.key)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(result.activity.map((point: DashboardActivityPoint) => point.total)).toEqual([0, 1, 0, 0, 1, 1]);
    expect(result.kpis.proposalsReceived).toBe(2);
  });

  it("excludes archived briefs from active readiness and pipeline metrics", () => {
    const result = buildCustomerDashboardAnalytics({
      now,
      briefs: [
        brief({ stage: "INTAKE", completion: 40, hasActionRequired: true }),
        brief({ stage: "REVIEW", completion: 80 }),
        brief({ stage: "SELECTION", status: "ARCHIVED", completion: 100, hasActionRequired: true }),
      ],
      proposals: [{ submittedAt: "2026-08-01T10:00:00.000Z" }],
    });

    expect(result.kpis).toEqual({
      activeBriefs: 2,
      averageReadiness: 60,
      proposalsReceived: 1,
      decisionsDue: 1,
    });
    expect(result.stageDistribution.find((stage: DashboardStageMetric) => stage.stage === "INTAKE")?.count).toBe(1);
    expect(result.stageDistribution.find((stage: DashboardStageMetric) => stage.stage === "REVIEW")?.count).toBe(1);
    expect(result.stageDistribution.find((stage: DashboardStageMetric) => stage.stage === "SELECTION")?.count).toBe(0);
  });

  it("keeps customer analytics owner-scoped and includes unlinked customer meetings", () => {
    expect(dashboardPage).toContain('WHERE b."ownerId" = $1');
    expect(dashboardPage).toContain('p."releasedAt" IS NOT NULL');
    expect(dashboardPage).toContain('WHERE m."customerUserId" = $1');
  });
});

function brief(overrides: Partial<{
  stage: string;
  status: string;
  completion: number;
  createdAt: string;
  hasActionRequired: boolean;
}> = {}) {
  return {
    stage: "INTAKE",
    status: "ACTIVE",
    completion: 0,
    createdAt: "2026-08-01T10:00:00.000Z",
    hasActionRequired: false,
    ...overrides,
  };
}
