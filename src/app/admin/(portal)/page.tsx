import Link from "next/link";
import {
  FileText,
  TrendingUp,
  Building2,
  Users,
  ArrowUpRight,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { query, count } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo, cn } from "@/lib/utils";
import { STAGE_ORDER } from "@/lib/constants";
import { CronHealthPanel } from "@/components/admin/cron-health-panel";

export const dynamic = "force-dynamic";

const STAGE_BAR_COLORS = [
  "bg-primary",
  "bg-primary/90",
  "bg-primary/80",
  "bg-primary/70",
  "bg-primary/60",
  "bg-primary/50",
];

export default async function AdminOverviewPage() {
  const [
    briefCount,
    activeBriefs,
    partnerCount,
    userCount,
    recentBriefs,
    byStage,
  ] = await Promise.all([
    count('SELECT COUNT(*) FROM "ProjectBrief"'),
    count(`SELECT COUNT(*) FROM "ProjectBrief" WHERE "status" = 'ACTIVE'`),
    count(`SELECT COUNT(*) FROM "Company" WHERE "kind" = 'PARTNER'`),
    count('SELECT COUNT(*) FROM "User"'),
    query<{
      id: string;
      title: string;
      stage: string;
      updatedAt: Date;
      companyName: string | null;
    }>(
      `SELECT b."id", b."title", b."stage", b."updatedAt", c."name" AS "companyName"
       FROM "ProjectBrief" b
       LEFT JOIN "Company" c ON c."id" = b."companyId"
       ORDER BY b."updatedAt" DESC LIMIT 5`,
    ),
    query<{ stage: string; count: number }>(
      `SELECT "stage", COUNT(*)::int AS "count" FROM "ProjectBrief" GROUP BY "stage"`,
    ),
  ]);

  const stageMap = Object.fromEntries(
    byStage.map((r) => [r.stage, r.count]),
  ) as Record<string, number>;

  const kpis = [
    {
      label: "Total Briefs",
      value: briefCount,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      glow: "hover:border-primary/30 hover:shadow-elev-2",
    },
    {
      label: "Active Pipelines",
      value: activeBriefs,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      glow: "hover:border-primary/30 hover:shadow-elev-2",
    },
    {
      label: "Verified Partners",
      value: partnerCount,
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success/10 border-success/20",
      glow: "hover:border-success/30 hover:shadow-elev-2",
    },
    {
      label: "Total Users",
      value: userCount,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      glow: "hover:border-primary/30 hover:shadow-elev-2",
    },
  ];

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      {/* Header */}
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden>
            <Building2 className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">System Administration</div>
            <h1 className="portal-page-title">Control Center</h1>
          </div>
        </div>
      </header>

      {/* Scheduler health — everything time-based fails silently
          without it, so it sits above the fold. */}
      <CronHealthPanel />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => (
          <Card
            key={k.label}
            className={cn("customer-panel group transition-colors", k.glow)}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-primary/70", k.color)} />
            <CardContent className="space-y-3 p-5">
              <div className={cn(
                "portal-icon-box border",
                k.bg,
                k.color,
              )}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[12px] font-medium text-muted-foreground">{k.label}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{k.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Activity feed */}
        <Card
          className="customer-panel overflow-hidden lg:col-span-8"
          style={{ animationDelay: "320ms" }}
        >
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
          <CardHeader className="customer-panel-header flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold text-foreground">Recent Activity</CardTitle>
              <p className="text-xs text-muted-foreground font-medium">Latest brief activity across the platform.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl text-xs font-bold">
              <Link href="/admin/briefs">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {recentBriefs.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-7 py-5 hover:bg-secondary/30 transition-colors group"
                >
                  <div className="flex items-center gap-5">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary border border-border text-muted-foreground group-hover:bg-primary/10 group-hover:border-primary/20 group-hover:text-primary transition-all">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {b.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="text-foreground/70">{b.companyName}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span>{timeAgo(b.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider hidden sm:flex">
                      {b.stage}
                    </Badge>
                    <Button asChild size="icon" variant="ghost" className="h-9 w-9 rounded-xl">
                      <Link href={`/admin/briefs/${b.id}`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar cards */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pipeline velocity */}
          <Card
            className="customer-panel overflow-hidden"
            style={{ animationDelay: "400ms" }}
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" />
            <CardHeader className="customer-panel-header">
              <CardTitle className="text-base font-semibold text-foreground">Pipeline Velocity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {STAGE_ORDER.map((s, i) => {
                const count = stageMap[s] ?? 0;
                const percentage = briefCount > 0 ? (count / briefCount) * 100 : 0;
                const barColor = STAGE_BAR_COLORS[i % STAGE_BAR_COLORS.length];
                return (
                  <div key={s} className="group space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {s}
                      </div>
                      <div className="text-xs font-bold text-foreground">{count}</div>
                    </div>
                    <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", barColor)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Growth card */}
          <Card
            className="customer-panel border-primary/20 bg-primary/5"
            style={{ animationDelay: "480ms" }}
          >
            <CardContent className="p-7 space-y-5">
              <div className="portal-icon-box border border-primary/20 bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <div className="text-base font-semibold text-foreground">Platform Growth</div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  System matches are up 24% this week. Consider expanding Premier partner outreach.
                </p>
              </div>
              <Button variant="outline" className="w-full h-9 text-sm font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10">
                Download Insights
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
