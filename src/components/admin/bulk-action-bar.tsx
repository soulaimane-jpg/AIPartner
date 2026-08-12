"use client";

/**
 * Floating bulk-action bar that appears when 1+ briefs are selected
 * in the admin briefs table. Pure client; the table itself owns the
 * selection state and passes it in.
 *
 * Actions:
 *   - **Triage**  → `bulkTriageBriefsAction`
 *   - **Stage**   → `bulkChangeStageAction` with a stage picker
 *   - **Archive** → `bulkArchiveBriefsAction` (confirm)
 *   - **Clear**   → caller-supplied callback that wipes selection.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Archive, Layers3, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATES, type LeadState } from "@/lib/enums";
import { LEAD_STATE_LABELS } from "@/lib/constants";
import {
  bulkTriageBriefsAction,
  bulkChangeStageAction,
  bulkArchiveBriefsAction,
} from "@/lib/actions/admin-bulk";

export function BulkActionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (selectedIds.length === 0) return null;

  function refresh() {
    router.refresh();
    onClear();
  }

  function triage() {
    startTransition(async () => {
      const result = await bulkTriageBriefsAction({ briefIds: selectedIds });
      if (result.ok) {
        toast.success(`Triaged ${result.data.count}`);
        refresh();
      } else {
        toast.error("Could not triage");
      }
    });
  }

  function archive() {
    if (
      !window.confirm(
        `Archive ${selectedIds.length} brief${selectedIds.length === 1 ? "" : "s"}? They'll be hidden from the active list.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await bulkArchiveBriefsAction({ briefIds: selectedIds });
      if (result.ok) {
        toast.success(`Archived ${result.data.count}`);
        refresh();
      } else {
        toast.error("Could not archive");
      }
    });
  }

  function changeStage(leadState: LeadState) {
    startTransition(async () => {
      const result = await bulkChangeStageAction({
        briefIds: selectedIds,
        leadState,
      });
      if (!result.ok) {
        toast.error("Could not move");
        return;
      }
      const moved = result.data.count;
      const skipped = selectedIds.length - moved;
      // Briefs that can't legally make the hop are skipped rather than
      // force-written, so say so instead of implying they all moved.
      toast.success(
        skipped > 0
          ? `Moved ${moved} → ${LEAD_STATE_LABELS[leadState] ?? leadState} (${skipped} skipped — illegal transition)`
          : `Moved ${moved} → ${LEAD_STATE_LABELS[leadState] ?? leadState}`,
      );
      refresh();
    });
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-2xl border border-border bg-card shadow-elev-2 px-3 py-2 flex items-center gap-2"
    >
      <span className="text-[12px] font-medium pl-1">
        {selectedIds.length} selected
      </span>

      <Button
        size="sm"
        variant="outline"
        onClick={triage}
        disabled={pending}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Triage
      </Button>

      <Select
        onValueChange={(v) => changeStage(v as LeadState)}
        disabled={pending}
      >
        <SelectTrigger className="h-8 w-[140px]">
          <Layers3 className="h-3.5 w-3.5 mr-1" />
          <SelectValue placeholder="Move to…" />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STATE_LABELS[s] ?? s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        onClick={archive}
        disabled={pending}
        className="text-destructive"
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </Button>

      <span className="w-px h-5 bg-border" aria-hidden />

      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        disabled={pending}
        aria-label="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
