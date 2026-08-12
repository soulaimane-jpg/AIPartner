"use client";

/**
 * M8b — one anonymization review: original vs anonymized side-by-side
 * per section (editable), replacement list, approve / reject / re-run.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  X,
  RefreshCcw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminReviewAnonymizationAction,
  adminRerunAnonymizationAction,
} from "@/lib/actions/qc";
import { mapErrorToToast } from "@/lib/schemas/errors";
import { PROPOSAL_SECTIONS, isProposalSectionKey } from "@/lib/sections";

export function AnonymizationReviewCard({
  anonymizedProposalId,
  proposalId,
  briefTitle,
  partnerName,
  placeholderLabel,
  originalSections,
  anonymizedSections,
  replacements,
}: {
  anonymizedProposalId: string;
  proposalId: string;
  briefTitle: string;
  partnerName: string;
  placeholderLabel: string;
  originalSections: Record<string, string>;
  anonymizedSections: Record<string, string>;
  replacements: { original: string; replacement: string; entityType: string }[];
}) {
  const router = useRouter();
  const [edited, setEdited] = React.useState<Record<string, string>>(
    anonymizedSections,
  );
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error as never));
    });
  };

  const sectionKeys = Object.keys(edited).filter(isProposalSectionKey);

  return (
    <section className="customer-panel overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <h2 className="text-[14px] font-semibold text-foreground">
          {briefTitle}
        </h2>
        <Badge variant="outline" className="text-[10px] font-mono">
          {placeholderLabel}
        </Badge>
        <span className="text-[12px] text-muted-foreground">
          {partnerName} → anonymized
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            run(() => adminRerunAnonymizationAction({ proposalId }))
          }
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Re-run LLM pass
        </Button>
      </header>

      {replacements.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-secondary/20">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
            Replacements made ({replacements.length})
          </div>
          <ul className="flex flex-wrap gap-2">
            {replacements.map((r, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-[11.5px]"
              >
                <span className="text-red-700 line-through">{r.original}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-emerald-700">{r.replacement}</span>
                <span className="text-muted-foreground">({r.entityType})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="divide-y divide-border">
        {sectionKeys.map((key) => (
          <div key={key} className="px-5 py-4">
            <h3 className="text-[12.5px] font-semibold text-foreground mb-2">
              {isProposalSectionKey(key) ? PROPOSAL_SECTIONS[key].label : key}
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
                  Original (partner)
                </div>
                <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {originalSections[key] ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-1">
                  Anonymized (editable)
                </div>
                <textarea
                  value={edited[key] ?? ""}
                  onChange={(e) =>
                    setEdited((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  rows={Math.min(
                    10,
                    Math.max(3, (edited[key] ?? "").split("\n").length + 1),
                  )}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="px-5 py-4 border-t border-border space-y-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reviewer notes (optional)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
        />
        {error && (
          <p className="text-[13px] text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() =>
                adminReviewAnonymizationAction({
                  anonymizedProposalId,
                  decision: "rejected",
                  reviewerNotes: notes || undefined,
                }),
              )
            }
          >
            <X className="h-4 w-4" /> Reject
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() =>
                adminReviewAnonymizationAction({
                  anonymizedProposalId,
                  decision: "approved",
                  editedSections: edited,
                  reviewerNotes: notes || undefined,
                }),
              )
            }
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve for comparison
          </Button>
        </div>
      </footer>
    </section>
  );
}
