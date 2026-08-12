"use client";

/**
 * M11.5 — partner deal self-reporting (shown once selected).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Handshake, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { partnerReportDealAction } from "@/lib/actions/deals";
import { mapErrorToToast } from "@/lib/schemas/errors";

const OUTCOMES = [
  { value: "nda_signed", label: "NDA signed" },
  { value: "deal", label: "Deal won" },
  { value: "no_deal", label: "No deal" },
  { value: "dropped_off", label: "Customer dropped off" },
] as const;

export function DealReportForm({
  briefId,
  matchId,
}: {
  briefId: string;
  matchId: string;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = React.useState<string>("");
  const [value, setValue] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await partnerReportDealAction({
        briefId,
        matchId,
        outcome: outcome as never,
        contractValueCents: value ? Math.round(Number(value) * 100) : undefined,
        notes: notes || undefined,
      });
      if (result.ok) {
        setSent(true);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-2 text-[13px] text-emerald-800">
        <CheckCircle2 className="h-4 w-4" /> Deal report received — thank you.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5 shadow-elev-1">
      <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
        <Handshake className="h-4 w-4" /> Report engagement status
      </h3>
      <p className="text-[12.5px] text-muted-foreground">
        Keep AIPartner in the loop on how the engagement develops — this is
        part of the partner terms.
      </p>
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setOutcome(o.value)}
            className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
              outcome === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-secondary/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {outcome === "deal" && (
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Contract value (€)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
      />
      {error && (
        <p className="text-[12.5px] text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={pending || !outcome} size="sm">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Submit report
      </Button>
    </div>
  );
}
