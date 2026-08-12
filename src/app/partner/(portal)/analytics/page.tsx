import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
  ThumbsDown,
  Timer,
  Trophy,
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  PartnerMetricCard,
  PartnerPageHeader,
  partnerMetricIcons,
} from "@/components/partner/partner-workspace-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatResponseMs } from "@/lib/partner-ops-shared";
import {
  getPartnerSelfAnalytics,
  MIN_BENCHMARK_COHORT,
  type BenchmarkStat,
} from "@/lib/partner-self-analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Partner · AI Partner" };

const WINDOW_DAYS = 90;

function formatPct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function formatCsat(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}/10`;
}

export default async function PartnerAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/partner/login");
  if (session.user.role !== "PARTNER" || !session.user.companyId) {
    redirect("/partner/login");
  }

  const analytics = await getPartnerSelfAnalytics(session.user.companyId, {
    sinceDays: WINDOW_DAYS,
  });
  const { metrics, benchmarks, lossReasons } = analytics;

  const rows = [
    {
      label: "Win rate",
      help: "Proposals selected ÷ proposals submitted",
      own: formatPct(metrics.winRate),
      benchmark: benchmarks.winRate,
      formatMedian: formatPct,
    },
    {
      label: "Accept rate",
      help: "Invitations accepted ÷ invitations answered",
      own: formatPct(metrics.acceptRate),
      benchmark: benchmarks.acceptRate,
      formatMedian: formatPct,
    },
    {
      label: "Response time",
      help: "Median time from invitation to your answer",
      own: formatResponseMs(metrics.medianResponseMs),
      benchmark: benchmarks.medianResponseMs,
      formatMedian: (v: number | null) => formatResponseMs(v),
    },
    {
      label: "CSAT",
      help: "Average engagement NPS, 3+ responses",
      own: formatCsat(metrics.csat),
      benchmark: benchmarks.csat,
      formatMedian: (v: number | null) => formatCsat(v),
    },
  ];

  const declineMax = Math.max(1, ...lossReasons.declines.map((d) => d.count));

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <PartnerPageHeader
        eyebrow="Analytics"
        title="Your performance"
        description={`How your team responded, bid, and delivered over the last ${WINDOW_DAYS} days — measured exactly the way we measure it internally.`}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PartnerMetricCard
          label="Proposals submitted"
          value={metrics.proposalsSubmitted}
          detail={`Across ${metrics.totalMatches} ${metrics.totalMatches === 1 ? "match" : "matches"}`}
          icon={partnerMetricIcons.pipeline}
          tone="blue"
        />
        <PartnerMetricCard
          label="Won"
          value={metrics.won}
          detail={`${formatPct(metrics.winRate)} win rate`}
          icon={Trophy}
          tone="emerald"
        />
        <PartnerMetricCard
          label="Accept rate"
          value={formatPct(metrics.acceptRate)}
          detail="Invitations you answered yes to"
          icon={CheckCircle2}
          tone="slate"
        />
        <PartnerMetricCard
          label="Response time"
          value={formatResponseMs(metrics.medianResponseMs)}
          detail="Median invitation to answer"
          icon={Timer}
          tone="blue"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <Card className="min-w-0 border-line bg-card shadow-elev-1">
          <CardHeader className="border-b border-line">
            <CardTitle className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground">
              <Gauge className="h-[18px] w-[18px] text-primary" />
              How you compare
            </CardTitle>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Anonymous medians across the other {analytics.cohortSize}{" "}
              approved partners on the roster — aggregate only, never an
              individual partner.
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-line p-0">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground">{row.label}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{row.help}</p>
                </div>
                <div className="flex shrink-0 items-center gap-5">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      You
                    </p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums leading-none text-foreground">
                      {row.own}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Roster median
                    </p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums leading-none text-muted-foreground">
                      {row.benchmark ? row.formatMedian(row.benchmark.median) : "—"}
                    </p>
                  </div>
                  <PercentileBadge stat={row.benchmark} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-fit border-line bg-card shadow-elev-1">
          <CardContent className="p-5 sm:p-6">
            <div className="portal-icon-box h-10 w-10 rounded-xl">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </div>
            <h2 className="mt-5 text-[15px] font-semibold tracking-tight text-foreground">
              Benchmarks are anonymous
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              You see cohort medians and where you sit in the distribution —
              never another partner&apos;s name or numbers. A benchmark is
              hidden entirely until at least {MIN_BENCHMARK_COHORT} other
              partners have data for it, because a median over a handful of
              firms can be traced back to one of them.
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Other partners see your numbers the same way: as one anonymous
              point in this cohort.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="border-line bg-card shadow-elev-1">
          <CardHeader className="border-b border-line">
            <CardTitle className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground">
              <ThumbsDown className="h-[18px] w-[18px] text-primary" />
              Why you passed
            </CardTitle>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {lossReasons.declinedTotal > 0
                ? `${lossReasons.declinedTotal} declined ${lossReasons.declinedTotal === 1 ? "invitation" : "invitations"} in this window.`
                : "You have not declined an invitation in this window."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-5 sm:p-6">
            {lossReasons.declines.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Decline reasons appear here once you pass on a brief — they help
                us route better-fitting work to your team.
              </p>
            ) : (
              lossReasons.declines.map((d) => (
                <div key={d.reason} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {d.label}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                      {d.count}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((d.count / declineMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-line bg-card shadow-elev-1">
          <CardHeader className="border-b border-line">
            <CardTitle className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-foreground">
              <BarChart3 className="h-[18px] w-[18px] text-primary" />
              Proposal outcomes
            </CardTitle>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Every proposal your team submitted in this window.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            <OutcomeStat label="Won" value={metrics.won} tone="emerald" icon={Trophy} />
            <OutcomeStat
              label="Lost"
              value={lossReasons.proposalsLost}
              tone="slate"
              icon={ThumbsDown}
            />
            <OutcomeStat
              label="Awaiting decision"
              value={lossReasons.proposalsPending}
              tone="amber"
              icon={Clock3}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PercentileBadge({ stat }: { stat: BenchmarkStat | null }) {
  if (!stat) {
    return (
      <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium">
        Cohort too small
      </Badge>
    );
  }
  if (stat.percentile == null) {
    return (
      <Badge variant="secondary" className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium">
        No data yet
      </Badge>
    );
  }
  const strong = stat.percentile >= 60;
  const weak = stat.percentile < 40;
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
        strong && "border-emerald-200 bg-emerald-50 text-emerald-800",
        weak && "border-amber-200 bg-amber-50 text-amber-800",
        !strong && !weak && "border-primary/20 bg-primary/5 text-primary",
      )}
    >
      {ordinal(stat.percentile)} percentile
    </Badge>
  );
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th";
  return `${value}${suffix}`;
}

function OutcomeStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "slate";
  icon: LucideIcon;
}) {
  const style = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    slate: "border-border bg-secondary text-muted-foreground",
  }[tone];

  return (
    <div className="rounded-xl border border-line bg-surface-sunk p-4">
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg border", style)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[22px] font-semibold leading-none tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}
