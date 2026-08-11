"use client";

/**
 * M8a — QC controls per submitted proposal on the admin brief page,
 * plus comparison build/release once columns are eligible.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ClipboardCheck,
  MessageSquareWarning,
  CheckCircle2,
  Table,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminStartQcAction,
  adminQcClarificationAction,
  adminResumeQcAction,
  adminQcPassAction,
  adminBuildComparisonAction,
  adminReleaseComparisonAction,
} from "@/lib/actions/qc";
import { mapErrorToToast } from "@/lib/schemas/errors";

export interface QcProposalRow {
  proposalId: string;
  partnerName: string;
  placeholderLabel: string | null;
  status: string;
  submittedAt: string | null;
  anonymizationStatus: string | null; // null = no pass yet
}

export function QcControls({
  briefId,
  leadState,
  proposals,
  comparisonStatus,
}: {
  briefId: string;
  leadState: string;
  proposals: QcProposalRow[];
  comparisonStatus: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [clarifyFor, setClarifyFor] = React.useState<string | null>(null);
  const [clarifyBody, setClarifyBody] = React.useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setClarifyFor(null);
        setClarifyBody("");
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error as never));
      }
    });
  };

  const submitted = proposals.filter((p) => p.submittedAt);
  const eligibleForComparison = submitted.filter(
    (p) => p.status === "QC_PASSED" && p.anonymizationStatus === "approved",
  );

  if (submitted.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-background p-5 space-y-4">
      <header className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[14px] font-semibold text-foreground">
          Proposal QC &amp; comparison
        </h2>
      </header>

      <ul className="divide-y divide-border">
        {submitted.map((p) => (
          <li key={p.proposalId} className="py-2.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-foreground">
                {p.partnerName}
              </span>
              {p.placeholderLabel && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {p.placeholderLabel}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {p.status}
              </Badge>
              {p.anonymizationStatus && (
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider ${
                    p.anonymizationStatus === "approved"
                      ? "border-emerald-300 text-emerald-700"
                      : "border-amber-300 text-amber-700"
                  }`}
                >
                  anon: {p.anonymizationStatus}
                </Badge>
              )}
              <div className="ml-auto flex gap-1.5">
                {p.status === "SUBMITTED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => adminStartQcAction({ proposalId: p.proposalId }))
                    }
                  >
                    Start QC
                  </Button>
                )}
                {p.status === "CLARIFICATION_NEEDED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => adminResumeQcAction({ proposalId: p.proposalId }))
                    }
                  >
                    Resume QC
                  </Button>
                )}
                {p.status === "IN_QC" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        setClarifyFor(
                          clarifyFor === p.proposalId ? null : p.proposalId,
                        )
                      }
                    >
                      <MessageSquareWarning className="h-3.5 w-3.5" />
                      Clarify
                    </Button>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => adminQcPassAction({ proposalId: p.proposalId }))
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pass QC
                    </Button>
                  </>
                )}
              </div>
            </div>

            {clarifyFor === p.proposalId && (
              <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
                <textarea
                  value={clarifyBody}
                  onChange={(e) => setClarifyBody(e.target.value)}
                  rows={3}
                  placeholder="Questions for the partner…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={pending || clarifyBody.trim().length < 3}
                    onClick={() =>
                      run(() =>
                        adminQcClarificationAction({
                          proposalId: p.proposalId,
                          body: clarifyBody,
                        }),
                      )
                    }
                  >
                    {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Send clarification
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        <Button
          variant="outline"
          disabled={pending || eligibleForComparison.length === 0}
          onClick={() => run(() => adminBuildComparisonAction({ briefId }))}
        >
          <Table className="h-4 w-4" />
          Build comparison ({eligibleForComparison.length} eligible)
        </Button>
        {comparisonStatus === "draft" && (
          <Button
            disabled={pending || leadState !== "PROPOSALS_IN_REVIEW"}
            onClick={() => run(() => adminReleaseComparisonAction({ briefId }))}
          >
            <Rocket className="h-4 w-4" />
            Reviewed &amp; approved — release to customer
          </Button>
        )}
        {comparisonStatus === "released" && (
          <Badge variant="outline" className="text-[10.5px] uppercase tracking-wider border-emerald-300 text-emerald-700">
            Comparison released — columns follow the stagger cadence
          </Badge>
        )}
      </div>

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
