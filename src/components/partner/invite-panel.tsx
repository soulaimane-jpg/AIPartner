"use client";

/**
 * M6 — partner invite panel: accept/decline inside T1, proposal
 * deadline countdown (T2), one-time extension request. Rendered at
 * the top of the partner brief page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  X,
  Clock,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  partnerAcceptInviteAction,
  partnerDeclineInviteAction,
  partnerRequestExtensionAction,
} from "@/lib/actions/invites";
import { mapErrorToToast } from "@/lib/schemas/errors";

function useCountdown(deadlineIso: string | null): string | null {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - now;
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function InvitePanel({
  matchId,
  briefId,
  status,
  acceptDeadlineAt,
  proposalDeadlineAt,
  extensionUsed,
  anonymizedCompanySummary,
}: {
  matchId: string;
  briefId: string;
  status: string;
  acceptDeadlineAt: string | null;
  proposalDeadlineAt: string | null;
  extensionUsed: boolean;
  anonymizedCompanySummary: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  const [extOpen, setExtOpen] = React.useState(false);
  const [extNote, setExtNote] = React.useState("");

  const acceptLeft = useCountdown(acceptDeadlineAt);
  const proposalLeft = useCountdown(proposalDeadlineAt);

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setDeclineOpen(false);
        setExtOpen(false);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error as never));
      }
    });
  };

  const summaryCard = anonymizedCompanySummary ? (
    <div className="rounded-md bg-secondary/40 border border-border px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
        About the customer (anonymized)
      </div>
      <p className="text-[13px] text-foreground leading-relaxed">
        {anonymizedCompanySummary}
      </p>
    </div>
  ) : null;

  if (status === "INVITED" || status === "SOURCED") {
    const isSourced = status === "SOURCED";
    return (
      <div className="space-y-4 rounded-xl border border-line bg-card p-5 shadow-elev-1">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-[14px] font-semibold text-foreground">
            {isSourced ? "New opportunity available" : "New lead invitation"}
          </span>
          {!isSourced && acceptLeft && (
            <span className="ml-auto text-[12.5px] font-mono text-amber-700">
              {acceptLeft === "expired"
                ? "Window closed"
                : `${acceptLeft} to respond`}
            </span>
          )}
        </div>
        {summaryCard}
        {declineOpen ? (
          <div className="space-y-2">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={2}
              placeholder="Why are you passing? (helps us send you better-fitting leads)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setDeclineOpen(false)}>
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || declineReason.trim().length < 3}
                onClick={() =>
                  run(() =>
                    partnerDeclineInviteAction({
                      matchId,
                      briefId,
                      reason: declineReason,
                    }),
                  )
                }
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm decline
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              disabled={pending || (!isSourced && acceptLeft === "expired")}
              onClick={() =>
                run(() => partnerAcceptInviteAction({ matchId, briefId }))
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Accept lead
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeclineOpen(true)}
            >
              <X className="h-4 w-4" /> Decline
            </Button>
          </div>
        )}
        {error && (
          <p className="text-[12.5px] text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (status === "PARTNER_ACCEPTED" || status === "EXTENSION_REQUESTED") {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-card p-5 shadow-elev-1">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-foreground" />
          <span className="text-[14px] font-semibold text-foreground">
            Proposal in progress
          </span>
          {proposalLeft && (
            <span
              className={`ml-auto text-[12.5px] font-mono ${
                proposalLeft === "expired" ? "text-red-600" : "text-foreground"
              }`}
            >
              {proposalLeft === "expired"
                ? "Deadline passed"
                : `${proposalLeft} until deadline`}
            </span>
          )}
        </div>
        {summaryCard}
        {status === "EXTENSION_REQUESTED" ? (
          <p className="text-[13px] text-muted-foreground">
            Extension request pending — the AIPartner team will confirm
            shortly.
          </p>
        ) : extOpen ? (
          <div className="space-y-2">
            <textarea
              value={extNote}
              onChange={(e) => setExtNote(e.target.value)}
              rows={2}
              placeholder="Where do you stand with the proposal? (required for the extension request)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setExtOpen(false)}>
                Back
              </Button>
              <Button
                size="sm"
                disabled={pending || extNote.trim().length < 3}
                onClick={() =>
                  run(() =>
                    partnerRequestExtensionAction({
                      matchId,
                      briefId,
                      note: extNote,
                    }),
                  )
                }
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Request 24h extension
              </Button>
            </div>
          </div>
        ) : (
          !extensionUsed && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setExtOpen(true)}
            >
              <Clock className="h-3.5 w-3.5" /> Request one-time extension
            </Button>
          )
        )}
        {extensionUsed && status === "PARTNER_ACCEPTED" && (
          <p className="text-[12px] text-muted-foreground">
            Your one-time extension has been used.
          </p>
        )}
        {error && (
          <p className="text-[12.5px] text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (status === "PROPOSAL_EXPIRED" || status === "EXPIRED") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
        <div>
          <p className="text-[13.5px] font-medium text-red-800">
            {status === "EXPIRED"
              ? "The acceptance window for this lead has passed."
              : "The proposal deadline has passed."}
          </p>
          <p className="text-[12.5px] text-red-700 mt-0.5">
            Contact the AIPartner team if you still want to participate —
            invites can be re-opened at their discretion.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
