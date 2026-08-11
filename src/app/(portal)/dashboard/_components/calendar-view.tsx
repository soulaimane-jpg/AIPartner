"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceBrief } from "./types";

/**
 * Month‑grid calendar that plots briefs by their `targetGoLive` date.
 *
 * Briefs without a date are surfaced in an "Undated" panel below the
 * grid so they never silently disappear from the workspace.
 */
export function CalendarView({
  briefs,
  onSelect,
}: {
  briefs: WorkspaceBrief[];
  onSelect: (brief: WorkspaceBrief) => void;
}) {
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { dated, undated } = useMemo(() => {
    const dated: Array<{ brief: WorkspaceBrief; date: Date }> = [];
    const undated: WorkspaceBrief[] = [];
    for (const b of briefs) {
      const d = parseGoLive(b.targetGoLive);
      if (d) dated.push({ brief: b, date: d });
      else undated.push(b);
    }
    return { dated, undated };
  }, [briefs]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card border border-border shadow-elev-1 overflow-hidden">
        {/* Month toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(setCursor, -1)}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-120"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(setCursor, 1)}
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-120"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-[13px] font-medium text-foreground">
              {monthLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              setCursor({ year: d.getFullYear(), month: d.getMonth() });
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors duration-120"
          >
            Today
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 text-[11px] font-medium text-muted-foreground border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            const briefsHere = dated.filter(
              (x) =>
                x.date.getFullYear() === cell.date.getFullYear() &&
                x.date.getMonth() === cell.date.getMonth() &&
                x.date.getDate() === cell.date.getDate(),
            );
            const isToday = isSameDay(cell.date, new Date());
            return (
              <div
                key={i}
                className={cn(
                  "relative min-h-[96px] p-1.5 border-r border-b border-border/70 last:border-r-0",
                  !cell.inMonth && "bg-secondary/20 text-muted-foreground/60",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center text-[11px] tabular-nums",
                      isToday
                        ? "rounded-full bg-foreground text-background font-medium px-1.5"
                        : cell.inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {briefsHere.slice(0, 3).map(({ brief }) => (
                    <button
                      key={brief.id}
                      type="button"
                      onClick={() => onSelect(brief)}
                      className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10.5px] text-foreground bg-secondary/40 hover:bg-secondary/80 transition-colors duration-120"
                    >
                      {brief.title}
                    </button>
                  ))}
                  {briefsHere.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1.5">
                      +{briefsHere.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-2xl bg-card border border-border shadow-elev-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[12.5px] font-medium text-foreground">
              Briefs without a target go‑live
            </div>
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {undated.length}
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {undated.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect(b)}
                className="text-left rounded border border-border bg-background px-3 py-2 hover:bg-secondary/40 transition-colors duration-120"
              >
                <div className="text-[12.5px] font-medium text-foreground truncate">
                  {b.title}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {b.stage} · {b.completion}%
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function shiftMonth(
  setter: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>,
  delta: number,
) {
  setter((c) => {
    const d = new Date(c.year, c.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseGoLive(s: string | null): Date | null {
  if (!s) return null;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;
  // Accept "Q3 2025" / "Aug 2025" / "2025-08" loose forms — best effort.
  const m = /^(20\d{2})-(\d{1,2})/.exec(s.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
