import { Activity, ArrowUpRight, Layers3 } from "lucide-react";
import type { DashboardActivityPoint, DashboardStageMetric } from "@/lib/customer-dashboard";
import { cn } from "@/lib/utils";

export function AnalyticsOverview({
  activity,
  stages,
}: {
  activity: DashboardActivityPoint[];
  stages: DashboardStageMetric[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)]">
      <div className="customer-panel overflow-hidden">
        <header className="customer-panel-header">
          <div>
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Portfolio activity
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">Briefs created and proposals received over the last six months.</p>
          </div>
          <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
            <Legend swatch="bg-primary" label="Briefs" />
            <Legend swatch="bg-[hsl(var(--brand-3))]" label="Proposals" />
          </div>
        </header>
        <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-5">
          <ActivityChart data={activity} />
        </div>
      </div>

      <div className="customer-panel overflow-hidden">
        <header className="customer-panel-header">
          <div>
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
              <Layers3 className="h-4 w-4 text-primary" />
              Pipeline distribution
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">Where active briefs are now.</p>
          </div>
        </header>
        <div className="space-y-3.5 p-5 sm:p-6">
          {stages.map((stage, index) => (
            <div key={stage.stage}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {stage.count} · {stage.percentage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-label={`${stage.label}: ${stage.count} briefs`}>
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    index < 2 ? "bg-primary" : index < 4 ? "bg-[hsl(var(--brand-3))]" : "bg-primary/35",
                  )}
                  style={{ width: stage.count ? `${Math.max(stage.percentage, 7)}%` : "0%" }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-line pt-3 text-[11.5px] text-muted-foreground">
            <span>Active pipeline</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              {stages.reduce((sum, stage) => sum + stage.count, 0)} briefs
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActivityChart({ data }: { data: DashboardActivityPoint[] }) {
  const width = 720;
  const height = 230;
  const left = 38;
  const right = 14;
  const top = 20;
  const bottom = 34;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const max = Math.max(1, ...data.flatMap((point) => [point.briefs, point.proposals]));
  const x = (index: number) => left + (data.length === 1 ? 0 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => top + innerHeight - (value / max) * innerHeight;
  const briefsPath = pathFor(data.map((point) => point.briefs), x, y);
  const proposalsPath = pathFor(data.map((point) => point.proposals), x, y);
  const empty = data.every((point) => point.total === 0);

  return (
    <div className="relative min-h-[230px] w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full" role="img" aria-labelledby="portfolio-chart-title portfolio-chart-description">
        <title id="portfolio-chart-title">Portfolio activity over six months</title>
        <desc id="portfolio-chart-description">
          {data.map((point) => `${point.label}: ${point.briefs} briefs and ${point.proposals} proposals`).join(". ")}
        </desc>
        <defs>
          <linearGradient id="brief-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const lineY = top + innerHeight * ratio;
          const value = Math.round(max * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={lineY} y2={lineY} stroke="hsl(var(--line))" strokeDasharray="3 5" />
              <text x={left - 10} y={lineY + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{value}</text>
            </g>
          );
        })}
        {!empty && briefsPath && (
          <path d={`${briefsPath} L ${x(data.length - 1)} ${top + innerHeight} L ${x(0)} ${top + innerHeight} Z`} fill="url(#brief-area)" />
        )}
        <path d={briefsPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={proposalsPath} fill="none" stroke="hsl(var(--brand-3))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => (
          <g key={point.key}>
            <circle cx={x(index)} cy={y(point.briefs)} r="3.5" fill="white" stroke="hsl(var(--primary))" strokeWidth="2" />
            <circle cx={x(index)} cy={y(point.proposals)} r="3" fill="white" stroke="hsl(var(--brand-3))" strokeWidth="2" />
            <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{point.label}</text>
          </g>
        ))}
      </svg>
      {empty && (
        <div className="pointer-events-none absolute inset-x-12 top-[42%] text-center text-[12px] text-muted-foreground">
          Activity will build as briefs and proposals move through the platform.
        </div>
      )}
    </div>
  );
}

function pathFor(values: number[], x: (index: number) => number, y: (value: number) => number): string {
  return values.map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", swatch)} aria-hidden />
      {label}
    </span>
  );
}
