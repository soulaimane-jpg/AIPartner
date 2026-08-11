"use client";

/**
 * Structured decline dialog for partner inbox rows.
 *
 * Why a dialog (not a one-click button):
 *   The whole point of structured declines is the analytics signal.
 *   Forcing a 3-second pause + radio click is a feature, not friction.
 *
 * Validation: "Other" requires a free-text note (server-enforced too).
 */

import { useState, useTransition } from "react";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { declineMatchWithReasonAction } from "@/lib/actions/partner-decline";
import {
  DECLINE_REASONS,
  DECLINE_REASON_LABELS,
  type DeclineReason,
} from "@/lib/schemas/decline-reasons";

export function DeclineReasonDialog({
  matchId,
  briefTitle,
  onClose,
  onDeclined,
}: {
  matchId: string;
  briefTitle: string;
  onClose: () => void;
  onDeclined: () => void;
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [freeText, setFreeText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) {
      toast.error("Pick a reason first.");
      return;
    }
    if (reason === "other" && freeText.trim().length === 0) {
      toast.error("'Other' needs a brief note.");
      return;
    }
    startTransition(async () => {
      const result = await declineMatchWithReasonAction({
        matchId,
        reason,
        freeText: freeText.trim() || undefined,
      });
      if (result.ok) {
        toast.success("Declined — thanks for the signal.");
        onDeclined();
        onClose();
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not decline.",
        );
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Decline this lead"
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border border-line sm:rounded-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line">
          <div className="flex items-start gap-2 min-w-0">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Decline this lead</h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {briefTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Why are you passing on this one?
          </Label>
          <div className="grid gap-1.5">
            {DECLINE_REASONS.map((r) => (
              <label
                key={r}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="decline-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-[13px]">
                  {DECLINE_REASON_LABELS[r]}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {reason === "other" ? "Note (required)" : "Note (optional)"}
            </Label>
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Anything we should pass back to the customer?"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !reason}
            variant="outline"
            className="text-destructive"
          >
            {pending ? "Declining…" : "Decline lead"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
