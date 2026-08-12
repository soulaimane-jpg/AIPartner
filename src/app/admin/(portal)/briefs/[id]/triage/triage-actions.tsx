"use client";

/**
 * M4 triage decision controls: start triage, request clarification
 * (loops the lead back to the company), approve (with mandatory
 * anonymized company summary — §8 Layer 2).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminStartTriageAction,
  adminRequestClarificationAction,
  adminResumeTriageAction,
  adminApproveLeadAction,
} from "@/lib/actions/triage";
import { mapErrorToToast } from "@/lib/schemas/errors";

export function TriageActions({
  briefId,
  leadState,
  suggestedSummary,
}: {
  briefId: string;
  leadState: string;
  suggestedSummary: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [clarifyOpen, setClarifyOpen] = React.useState(false);
  const [clarifyBody, setClarifyBody] = React.useState("");
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [summary, setSummary] = React.useState(suggestedSummary);

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setClarifyOpen(false);
        setApproveOpen(false);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error as never));
      }
    });
  };

  return (
    <div className="customer-panel space-y-4 p-5">
      <h2 className="text-[14px] font-semibold text-foreground">
        Triage decision
      </h2>

      <div className="flex flex-wrap gap-2">
        {leadState === "SUBMITTED" && (
          <Button
            disabled={pending}
            onClick={() => run(() => adminStartTriageAction({ briefId }))}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start triage
          </Button>
        )}

        {leadState === "CLARIFICATION_NEEDED" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminResumeTriageAction({ briefId }))}
          >
            Resume triage (answers received)
          </Button>
        )}

        {(leadState === "IN_TRIAGE" || leadState === "SUBMITTED") && (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setClarifyOpen((v) => !v);
                setApproveOpen(false);
              }}
            >
              <MessageSquareWarning className="h-4 w-4" />
              Request clarification
            </Button>
            <Button
              disabled={pending || leadState !== "IN_TRIAGE"}
              onClick={() => {
                setApproveOpen((v) => !v);
                setClarifyOpen(false);
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              Approve lead…
            </Button>
          </>
        )}
      </div>

      {leadState !== "IN_TRIAGE" &&
        leadState !== "SUBMITTED" &&
        leadState !== "CLARIFICATION_NEEDED" && (
          <p className="text-[12.5px] text-muted-foreground">
            Lead state: <span className="font-mono">{leadState}</span> — triage
            is complete.
          </p>
        )}

      {clarifyOpen && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-4">
          <label className="text-[12.5px] font-medium text-foreground">
            Question(s) for the customer
          </label>
          <textarea
            value={clarifyBody}
            onChange={(e) => setClarifyBody(e.target.value)}
            rows={4}
            placeholder="What's unclear? The customer is notified and can answer by message or book a call."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={pending || clarifyBody.trim().length < 3}
              onClick={() =>
                run(() =>
                  adminRequestClarificationAction({
                    briefId,
                    body: clarifyBody,
                  }),
                )
              }
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send & mark clarification needed
            </Button>
          </div>
        </div>
      )}

      {approveOpen && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-4">
          <label className="text-[12.5px] font-medium text-foreground">
            Anonymized company summary{" "}
            <span className="font-normal text-muted-foreground">
              — the only company description partners will see pre-reveal
            </span>
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder='e.g. "Mid-size manufacturing company, ~2,000 employees, buying via reseller, data team of 6."'
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[11.5px] text-muted-foreground">
            No company name, domain, or identifying products. This is checked
            automatically against the company name.
          </p>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={pending || summary.trim().length < 20}
              onClick={() =>
                run(() =>
                  adminApproveLeadAction({
                    briefId,
                    anonymizedCompanySummary: summary,
                  }),
                )
              }
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Approve lead
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
