"use client";

import { cn } from "@/lib/utils";
import type { BriefStage } from "@/lib/enums";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/constants";
import { BriefCard } from "./brief-card";
import type { WorkspaceBrief } from "./types";

/**
 * Six‑column kanban board for the customer workspace. Columns mirror
 * the `STAGE_ORDER` pipeline; drag‑and‑drop is intentionally disabled
 * because the brief stage is driven by workflow actions, not by the
 * user dragging cards around.
 */
export function BoardView({
  briefs,
  onSelect,
}: {
  briefs: WorkspaceBrief[];
  onSelect: (brief: WorkspaceBrief) => void;
}) {
  const columns = STAGE_ORDER.map((stage) => ({
    stage: stage as BriefStage,
    label: STAGE_LABELS[stage] ?? stage,
    items: briefs.filter((b) => b.stage === stage),
  }));

  return (
    <div className="overflow-x-auto -mx-6 px-6 pb-2">
      <div className="flex gap-3 min-w-max pb-2">
        {columns.map((col) => (
          <div key={col.stage} className="w-[300px] shrink-0">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <span className="eyebrow">{col.label}</span>
              <span className="font-mono num text-[11px] text-muted-foreground">
                {String(col.items.length).padStart(2, "0")}
              </span>
            </div>

            <div className={cn("space-y-2 min-h-[120px]")}>
              {col.items.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-border/60 py-8 text-center text-[11.5px] text-muted-foreground/60 italic font-display">
                  No briefs here yet
                </div>
              ) : (
                col.items.map((b) => (
                  <BriefCard key={b.id} brief={b} onClick={onSelect} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
