/**
 * SLA pipeline board — pure RSC.
 *
 * Renders four columns (Fresh / Warm / Hot / Stuck) of brief cards
 * keyed off `bucketSla()`. Doesn't fetch — the page passes in the
 * full brief list and we group client-free.
 *
 * Each card is a thin link into the admin brief detail page; the
 * card itself doesn't carry actions. The intent here is *triage at
 * a glance*, not a Kanban editor.
 */

import Link from "next/link";
import type { ProjectBriefRow as ProjectBrief } from "@/lib/db/rows";
import { Clock, Flame, AlertOctagon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bucketSla,
  SLA_BUCKET_LABEL,
  SLA_BUCKET_CLASSES,
  type SlaBucket,
} from "@/lib/sla";

const COLUMNS: { bucket: SlaBucket; title: string; icon: typeof Clock }[] = [
  { bucket: "fresh", title: "Fresh", icon: CheckCircle2 },
  { bucket: "warm", title: "Warming up", icon: Clock },
  { bucket: "hot", title: "Hot", icon: Flame },
  { bucket: "stuck", title: "Stuck", icon: AlertOctagon },
];

export function SlaBoard({ briefs }: { briefs: ProjectBrief[] }) {
  const buckets = new Map<SlaBucket, { brief: ProjectBrief; ageHours: number; reason: string }[]>();
  for (const b of briefs) {
    const info = bucketSla(b);
    if (info.bucket === "none") continue;
    const arr = buckets.get(info.bucket) ?? [];
    arr.push({ brief: b, ageHours: info.ageHours, reason: info.reason });
    buckets.set(info.bucket, arr);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => b.ageHours - a.ageHours);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = buckets.get(col.bucket) ?? [];
        const Icon = col.icon;
        return (
          <section
            key={col.bucket}
            aria-label={col.title}
            className="rounded-2xl border border-line bg-card flex flex-col min-h-[200px]"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {col.title}
                <span className="text-[11px] text-muted-foreground font-mono">
                  · {SLA_BUCKET_LABEL[col.bucket]}
                </span>
              </div>
              <span className="font-mono tabular-nums text-sm">
                {items.length}
              </span>
            </header>
            <ul className="flex-1 px-3 py-3 space-y-2">
              {items.length === 0 ? (
                <li className="text-[11.5px] text-muted-foreground italic px-1">
                  Nothing here right now.
                </li>
              ) : (
                items.map(({ brief, ageHours, reason }) => (
                  <li key={brief.id}>
                    <Link
                      href={`/admin/briefs/${brief.id}`}
                      className={cn(
                        "block rounded-lg border px-3 py-2 transition-colors",
                        "hover:bg-card",
                        SLA_BUCKET_CLASSES[col.bucket],
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {brief.title}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums shrink-0">
                          {ageHours < 24
                            ? `${Math.round(ageHours)}h`
                            : `${Math.round(ageHours / 24)}d`}
                        </span>
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-80">
                        {brief.stage} · {reason}
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
