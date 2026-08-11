"use client";

/**
 * Pending re-scrape suggestions, accepted or rejected per field.
 *
 * The quarterly re-scrape never writes to a profile. It proposes, and the
 * partner decides. That distinction is the whole reason partners will tolerate
 * an automated crawler touching their data at all — and it means a change in
 * Google's directory markup can never silently rewrite a live profile.
 */

import { useState, useTransition } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveChangeProposalAction } from "@/lib/actions/partner-pillars";

export interface ChangeProposal {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  source: string;
  currentValue: string | null;
  proposedValue: string | null;
}

export function ChangeProposalsCard({
  proposals,
}: {
  proposals: ChangeProposal[];
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const outstanding = proposals.filter((p) => !resolved.has(p.id));
  if (outstanding.length === 0) return null;

  const decide = (id: string, decision: "accept" | "reject") => {
    setPendingId(id);
    startTransition(async () => {
      const result = await resolveChangeProposalAction({
        proposalId: id,
        decision,
      });
      setPendingId(null);
      if (result.ok) {
        // Optimistically hide it — the row is already resolved server-side and
        // re-fetching the whole page for one decision would feel sluggish.
        setResolved((prev) => new Set(prev).add(id));
        toast.success(decision === "accept" ? "Change applied" : "Suggestion dismissed");
      } else {
        toast.error("Could not save that decision");
      }
    });
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-blue-200 bg-white text-blue-700">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">
              {outstanding.length} suggested update
              {outstanding.length === 1 ? "" : "s"} from your public sources
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              We spotted differences between your profile and your public pages.
              Nothing changes until you accept it.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {outstanding.map((p) => (
            <div
              key={p.id}
              className="space-y-3 rounded-xl border border-blue-100 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-foreground">
                  {p.fieldLabel}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {p.source === "directory" ? "Google directory" : "Your website"}
                </span>
              </div>

              <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Current
                  </span>
                  <p className="rounded-lg bg-surface-sunk px-3 py-2 leading-relaxed text-muted-foreground line-through decoration-slate-300">
                    {p.currentValue || "— empty —"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-blue-700">
                    Suggested
                  </span>
                  <p className="rounded-lg bg-blue-50 px-3 py-2 leading-relaxed text-foreground">
                    {p.proposedValue || "— empty —"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pendingId === p.id}
                  onClick={() => decide(p.id, "accept")}
                  className="h-9 font-semibold"
                >
                  <Check className="h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === p.id}
                  onClick={() => decide(p.id, "reject")}
                  className="h-9 bg-card font-semibold"
                >
                  <X className="h-3.5 w-3.5" /> Keep mine
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
