"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  markBriefTriagedAction,
  confirmMeetingSlotAction,
} from "@/lib/actions/admin";

export type ProposedSlot = {
  startsAt: string;
  durationMins: number;
};

export function TriagePanel({
  briefId,
  briefTitle,
  customerName,
  customerCompany,
  proposedSlots,
  meetingConfirmedAt,
  triagedAt,
  initialNotes,
}: {
  briefId: string;
  briefTitle: string;
  customerName: string | null;
  customerCompany: string | null;
  proposedSlots: ProposedSlot[];
  meetingConfirmedAt: string | null;
  triagedAt: string | null;
  initialNotes: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();

  function handleConfirmSlot(idx: number) {
    startTransition(async () => {
      const result = await confirmMeetingSlotAction({
        briefId,
        slotIndex: idx,
      });
      if (result.ok) {
        toast.success("Meeting slot confirmed — customer notified");
        router.refresh();
      } else {
        toast.error(
          result.error.code === "CONFLICT" && "reason" in result.error
            ? result.error.reason
            : "Could not confirm",
        );
      }
    });
  }

  function handleMarkTriaged() {
    startTransition(async () => {
      const result = await markBriefTriagedAction({
        briefId,
        notes: notes.trim() || undefined,
      });
      if (result.ok) {
        toast.success("Brief marked as real lead — sourcing can begin");
        router.refresh();
      } else {
        toast.error("Could not mark triaged");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">
              Triage: {briefTitle}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {customerName || "Customer"}
              {customerCompany ? ` · ${customerCompany}` : ""}
            </p>
          </div>
          {triagedAt ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success bg-success/10 border border-success/20 rounded-full px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Triaged {new Date(triagedAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Clock className="h-3.5 w-3.5" />
              Awaiting triage
            </span>
          )}
        </header>
      </div>

      {/* Step 1 — Confirm alignment meeting */}
      <div className="rounded-2xl border border-line bg-card overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-line bg-surface-1">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-1/10 text-brand-1">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold">
                Step 1 · Confirm the alignment meeting
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Pick one of the customer-proposed times below.
              </p>
            </div>
          </div>
          {meetingConfirmedAt && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmed for {new Date(meetingConfirmedAt).toLocaleString()}
            </span>
          )}
        </header>
        <div className="p-6">
          {proposedSlots.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic">
              No meeting slots were proposed when this brief was submitted.
            </p>
          ) : (
            <ul className="space-y-2">
              {proposedSlots.map((s, i) => {
                const date = new Date(s.startsAt);
                const isConfirmed =
                  meetingConfirmedAt &&
                  new Date(meetingConfirmedAt).getTime() === date.getTime();
                return (
                  <li
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                      isConfirmed
                        ? "border-success/30 bg-success/5"
                        : "border-line bg-surface-1"
                    }`}
                  >
                    <div>
                      <div className="text-[13.5px] font-medium text-foreground">
                        {date.toLocaleString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {s.durationMins} min
                      </div>
                    </div>
                    {!meetingConfirmedAt && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirmSlot(i)}
                        disabled={pending}
                      >
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirm this slot
                      </Button>
                    )}
                    {isConfirmed && (
                      <span className="text-[11.5px] font-semibold text-success">
                        Locked in
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Step 2 — Gap-fill notes + mark triaged */}
      <div className="rounded-2xl border border-line bg-card overflow-hidden">
        <header className="flex items-center gap-3 px-6 py-4 border-b border-line bg-surface-1">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold">
              Step 2 · Capture gaps & confirm this is a real lead
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Anything the customer should fill in before we go to partners.
            </p>
          </div>
        </header>
        <div className="p-6 space-y-4">
          <FormField label="Internal triage notes" htmlFor="triage-notes">
            <Textarea
              id="triage-notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer didn't specify HIPAA boundary — clarified verbally that PHI is in scope. Budget envelope confirmed at €280-360k."
            />
          </FormField>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={handleMarkTriaged}
              disabled={pending}
              size="md"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ClipboardCheck className="h-3.5 w-3.5" />
              )}
              {triagedAt ? "Update triage" : "Mark as real lead → start sourcing"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
