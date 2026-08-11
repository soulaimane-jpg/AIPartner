"use client";

/**
 * Partner-side meeting slot picker.
 *
 * After accepting a lead, the partner proposes up to 3 time slots for an
 * alignment call. Mirrors the customer-side MeetingTimePicker but calls
 * `partnerProposeMeetingAction` instead of `submitBriefAction`.
 */

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { partnerProposeMeetingAction } from "@/lib/actions/partner-meeting";
import { mapErrorToToast } from "@/lib/schemas/errors";

type Slot = { startsAt: string; durationMins: number };

const DEFAULT_DURATION = 30;

function defaultSlot(daysAhead: number): Slot {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(15, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { startsAt: local, durationMins: DEFAULT_DURATION };
}

export function PartnerMeetingPicker({
  matchId,
  briefId,
  hasProposed,
  confirmedAt,
}: {
  matchId: string;
  briefId: string;
  hasProposed: boolean;
  confirmedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([
    defaultSlot(2),
    defaultSlot(4),
    defaultSlot(7),
  ]);
  const [agenda, setAgenda] = useState("");
  const [pending, startTransition] = useTransition();

  function updateSlot(i: number, patch: Partial<Slot>) {
    setSlots((s) => s.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeSlot(i: number) {
    setSlots((s) => s.filter((_, idx) => idx !== i));
  }
  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((s) => [...s, defaultSlot(s.length * 2 + 2)]);
  }

  function handleSubmit() {
    const cleaned = slots.filter((s) => s.startsAt.trim().length > 0);
    if (cleaned.length === 0) {
      toast.error("Propose at least one time slot");
      return;
    }
    startTransition(async () => {
      const result = await partnerProposeMeetingAction({
        matchId,
        briefId,
        proposedSlots: cleaned.map((s) => ({
          startsAt: new Date(s.startsAt).toISOString(),
          durationMins: s.durationMins,
        })),
        agenda: agenda.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(mapErrorToToast(result.error));
        return;
      }
      toast.success("Meeting slots proposed — we'll confirm one shortly.");
      setOpen(false);
      window.location.reload();
    });
  }

  if (confirmedAt) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
        <div>
          <p className="text-[13.5px] font-medium text-emerald-800">
            Alignment meeting confirmed
          </p>
          <p className="text-[12.5px] text-emerald-700 mt-0.5">
            {new Date(confirmedAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  if (hasProposed && !open) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 flex items-start gap-3">
        <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-[13.5px] font-medium text-blue-800">
            Meeting slots proposed
          </p>
          <p className="text-[12.5px] text-blue-700 mt-0.5">
            Waiting for the AI Partner team to confirm one of your proposed times.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          Edit slots
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-background p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="text-[14px] font-semibold text-foreground">
            Schedule an alignment meeting
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Propose up to 3 time slots for a call with the customer. The AI Partner team will confirm one.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Propose meeting times
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cinema-bg/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-card border border-line shadow-elev-3 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-1/10 text-brand-1">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[16px] font-semibold tracking-tight">
                    Propose alignment meeting times
                  </h2>
                  <p className="text-[12.5px] text-muted-foreground">
                    The AI Partner team will confirm one slot with the customer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {slots.map((s, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-end"
                  >
                    <FormField
                      label={i === 0 ? "Time slot" : undefined}
                      htmlFor={`pmtg-${i}`}
                    >
                      <Input
                        id={`pmtg-${i}`}
                        type="datetime-local"
                        value={s.startsAt}
                        onChange={(e) =>
                          updateSlot(i, { startsAt: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField
                      label={i === 0 ? "Duration" : undefined}
                      htmlFor={`pmtg-dur-${i}`}
                    >
                      <select
                        id={`pmtg-dur-${i}`}
                        value={s.durationMins}
                        onChange={(e) =>
                          updateSlot(i, {
                            durationMins: parseInt(e.target.value, 10),
                          })
                        }
                        className="flex h-9 rounded-md border border-line bg-card text-[13.5px] px-3 shadow-[var(--elev-1)] focus-visible:outline-none focus-visible:border-brand-1"
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </FormField>
                    {slots.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove slot"
                        onClick={() => removeSlot(i)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {slots.length < 3 && (
                <button
                  type="button"
                  onClick={addSlot}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-1 hover:text-magenta-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another slot ({3 - slots.length} left)
                </button>
              )}

              <FormField
                label="Agenda or context (optional)"
                htmlFor="pmtg-agenda"
                helper=" Topics you'd like to cover or people who'll join."
              >
                <Textarea
                  id="pmtg-agenda"
                  rows={3}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="e.g. Technical deep-dive on GCP migration approach."
                />
              </FormField>
            </div>

            <footer className="flex items-center justify-between gap-3 px-6 py-4 bg-surface-1 border-t border-line">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Submit proposed times
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
