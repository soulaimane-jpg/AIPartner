/**
 * Scheduler health — RSC.
 *
 * Every deadline, reminder, digest, outbound email and the GDPR
 * retention purge depends on an external scheduler calling
 * `/api/cron/*`. When that stops, nothing errors — the product just
 * quietly stops doing anything time-based. This panel makes that
 * failure visible instead of silent.
 */

import { AlertTriangle, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { getCronHealth, type CronHealthStatus } from "@/lib/cron-heartbeat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const STATUS_META: Record<
  CronHealthStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: "Healthy",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: CheckCircle2,
  },
  stale: {
    label: "Overdue",
    cls: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: Clock,
  },
  failing: {
    label: "Failing",
    cls: "border-rose-200 bg-rose-50 text-rose-700",
    Icon: AlertTriangle,
  },
  never_run: {
    label: "Never run",
    cls: "border-slate-200 bg-slate-50 text-slate-600",
    Icon: CircleSlash,
  },
};

function formatInterval(minutes: number): string {
  if (minutes < 60) return `every ${minutes}m`;
  if (minutes < 60 * 24) return `every ${Math.round(minutes / 60)}h`;
  return `every ${Math.round(minutes / (60 * 24))}d`;
}

export async function CronHealthPanel() {
  const health = await getCronHealth();
  const unhealthy = health.filter((h) => h.status !== "ok");

  return (
    <Card
      className={
        unhealthy.length > 0
          ? "bg-white border-amber-200 shadow-sm"
          : "bg-white border-slate-200 shadow-sm"
      }
    >
      <CardHeader className="border-b border-slate-200 px-6 py-4">
        <CardTitle className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-slate-900">
          <span>Scheduler health</span>
          {unhealthy.length > 0 && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800"
            >
              {unhealthy.length} needs attention
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-200">
          {health.map((h) => {
            const meta = STATUS_META[h.status];
            return (
              <div
                key={h.job}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <meta.Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">
                      {h.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatInterval(h.expectedIntervalMinutes)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {h.description}
                  </p>
                  {h.lastError && (
                    <p className="mt-1 font-mono text-[11px] text-rose-600">
                      {h.lastError.slice(0, 160)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="text-xs text-slate-500">
                    {h.lastSuccessAt
                      ? `Succeeded ${timeAgo(h.lastSuccessAt)}`
                      : "No successful run recorded"}
                    {h.consecutiveFailures > 0 && (
                      <div className="text-rose-600">
                        {h.consecutiveFailures} consecutive failure
                        {h.consecutiveFailures === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={meta.cls}>
                    {meta.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
