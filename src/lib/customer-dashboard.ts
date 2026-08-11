import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";

export type DashboardBriefMetric = {
  stage: string;
  status: string;
  completion: number;
  createdAt: string | Date;
  hasActionRequired: boolean;
};

export type DashboardProposalMetric = {
  submittedAt: string | Date;
};

export type DashboardActivityPoint = {
  key: string;
  label: string;
  briefs: number;
  proposals: number;
  total: number;
};

export type DashboardStageMetric = {
  stage: string;
  label: string;
  count: number;
  percentage: number;
};

export type CustomerDashboardAnalytics = {
  kpis: {
    activeBriefs: number;
    averageReadiness: number;
    proposalsReceived: number;
    decisionsDue: number;
  };
  activity: DashboardActivityPoint[];
  stageDistribution: DashboardStageMetric[];
};

export function buildCustomerDashboardAnalytics({
  briefs,
  proposals,
  now = new Date(),
}: {
  briefs: DashboardBriefMetric[];
  proposals: DashboardProposalMetric[];
  now?: Date;
}): CustomerDashboardAnalytics {
  const active = briefs.filter((brief) => brief.status !== "ARCHIVED");
  const averageReadiness = active.length
    ? Math.round(active.reduce((sum, brief) => sum + clampPercentage(brief.completion), 0) / active.length)
    : 0;
  const activity = buildActivitySeries(briefs, proposals, now);
  const stageCounts = new Map(STAGE_ORDER.map((stage) => [stage, 0]));

  for (const brief of active) {
    if (stageCounts.has(brief.stage as (typeof STAGE_ORDER)[number])) {
      stageCounts.set(
        brief.stage as (typeof STAGE_ORDER)[number],
        (stageCounts.get(brief.stage as (typeof STAGE_ORDER)[number]) ?? 0) + 1,
      );
    }
  }

  const pipelineTotal = [...stageCounts.values()].reduce((sum, count) => sum + count, 0);
  const stageDistribution = STAGE_ORDER.map((stage) => {
    const count = stageCounts.get(stage) ?? 0;
    return {
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count,
      percentage: pipelineTotal ? Math.round((count / pipelineTotal) * 100) : 0,
    };
  });

  return {
    kpis: {
      activeBriefs: active.length,
      averageReadiness,
      proposalsReceived: proposals.length,
      decisionsDue: active.filter((brief) => brief.hasActionRequired).length,
    },
    activity,
    stageDistribution,
  };
}

function buildActivitySeries(
  briefs: DashboardBriefMetric[],
  proposals: DashboardProposalMetric[],
  now: Date,
): DashboardActivityPoint[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const points = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return {
      key: monthKey(date),
      label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      briefs: 0,
      proposals: 0,
      total: 0,
    };
  });
  const byKey = new Map(points.map((point) => [point.key, point]));

  for (const brief of briefs) {
    const point = byKey.get(monthKey(toDate(brief.createdAt)));
    if (point) point.briefs += 1;
  }
  for (const proposal of proposals) {
    const point = byKey.get(monthKey(toDate(proposal.submittedAt)));
    if (point) point.proposals += 1;
  }
  for (const point of points) point.total = point.briefs + point.proposals;

  return points;
}

function monthKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
}
