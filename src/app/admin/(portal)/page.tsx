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
  "bg-primary shadow-[0_0_6px_0_hsl(197_100%_52%/0.55)]",
  "bg-blue-500 shadow-[0_0_6px_0_hsl(215_100%_60%/0.5)]",
  "bg-violet-500 shadow-[0_0_6px_0_hsl(270_80%_65%/0.45)]",
  "bg-amber-500 shadow-[0_0_6px_0_hsl(38_95%_55%/0.45)]",
  "bg-emerald-500 shadow-[0_0_6px_0_hsl(168_84%_42%/0.45)]",
  "bg-rose-500 shadow-[0_0_6px_0_hsl(350_90%_60%/0.4)]",
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
      glow: "hover:shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.25)]",
    },
    {
      label: "Active Pipelines",
      value: activeBriefs,
      icon: Activity,
      color: "text-indigo-600",
      bg: "bg-indigo-50 border-indigo-100",
      glow: "hover:shadow-[0_8px_32px_-8px_rgba(79,70,229,0.15)]",
    },
    {
      label: "Verified Partners",
      value: partnerCount,
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success/10 border-success/20",
      glow: "hover:shadow-[0_8px_32px_-8px_hsl(var(--success)/0.25)]",
    },
    {
      label: "Total Users",
      value: userCount,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-100",
      glow: "hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.15)]",
    },
  ];

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <header
        className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Building2 className="h-3 w-3" />
          System Administration
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
          Control Center
        </h1>
      </header>

      {/* Scheduler health — everything time-based fails silently
          without it, so it sits above the fold. */}
      <CronHealthPanel />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k, i) => (
          <Card
            key={k.label}
            className={cn("modern-card group animate-card-rise transition-all duration-300", k.glow)}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={cn("absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-current/50 via-current/20 to-transparent opacity-60", k.color)} />
            <CardContent className="p-6 pt-6 sm:p-6 space-y-3.5">
              <div className={cn(
                "grid h-11 w-11 place-items-center rounded-xl border transition-transform group-hover:scale-110",
                k.bg,
                k.color,
              )}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{k.label}</div>
                <div className={cn("font-display text-3xl font-bold mt-1.5", k.color)}>{k.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Activity feed */}
        <Card
          className="modern-card lg:col-span-8 animate-card-rise"
          style={{ animationDelay: "320ms" }}
        >
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
          <CardHeader className="p-7 border-b border-border/50 flex flex-row items-center justify-between bg-secondary/20">
            <div className="space-y-0.5">
              <CardTitle className="font-display text-lg font-bold text-foreground">Recent Activity</CardTitle>
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
            className="modern-card animate-card-rise"
            style={{ animationDelay: "400ms" }}
          >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500/50 via-primary/30 to-transparent" />
            <CardHeader className="p-7 border-b border-border/50 bg-secondary/20">
              <CardTitle className="font-display text-base font-bold text-foreground">Pipeline Velocity</CardTitle>
            </CardHeader>
            <CardContent className="p-7 space-y-5">
              {STAGE_ORDER.map((s, i) => {
                const count = stageMap[s] ?? 0;
                const percentage = briefCount > 0 ? (count / briefCount) * 100 : 0;
                const barColor = STAGE_BAR_COLORS[i % STAGE_BAR_COLORS.length];
                return (
                  <div key={s} className="group space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
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
            className="modern-card bg-primary/5 border-primary/20 animate-card-rise"
            style={{ animationDelay: "480ms" }}
          >
            <CardContent className="p-7 space-y-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 border border-primary/25 text-primary shadow-[0_0_16px_-4px_hsl(197_100%_52%/0.4)]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <div className="font-display text-lg font-bold text-foreground">Platform Growth</div>
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
