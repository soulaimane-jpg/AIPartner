"use client";

/**
 * AI-ranked sourcing panel — embedded in the triage page.
 *
 * Shows the top-N partner cards with deterministic score + Claude
 * rationale + strengths/caveats. Each card has two CTAs:
 *   - **Compose outreach (AI)** → opens `<OutreachComposer>` modal
 *   - **Invite directly** → calls `adminAssignPartner` immediately
 *
 * Caching:
 *   - Initial render uses `initial` (server fetch already ran the
 *     AI ranking).
 *   - "Re-rank" button triggers `aiRankPartnersAction({ force: true })`.
 */

import { useState, useTransition } from "react";
import { Sparkles, RotateCw, Send, MessageSquareText, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aiRankPartnersAction } from "@/lib/actions/ai-sourcing";
import { adminAssignPartner } from "@/lib/actions/admin";
import { OutreachComposer } from "./outreach-composer";

export type SourcingItem = {
  partnerId: string;
  partnerName: string;
  score: number;
  label: string;
  rationale: string | null;
  confidence: number | null;
  strengths: string[];
  caveats: string[];
  reasons: string[];
};

export function SourcingPanel({
  briefId,
  initial,
}: {
  briefId: string;
  initial: SourcingItem[];
}) {
  const [items, setItems] = useState<SourcingItem[]>(initial);
  const [composerFor, setComposerFor] = useState<SourcingItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyPartner, setBusyPartner] = useState<string | null>(null);

  function rerank() {
    startTransition(async () => {
      const result = await aiRankPartnersAction({ briefId, force: true });
      if (result.ok) {
        setItems(result.data.items);
        toast.success("Re-ranked");
      } else {
        toast.error(
          result.error.code === "LLM_FAILURE"
            ? "AI reviewer is unavailable right now."
            : "Could not re-rank.",
        );
      }
    });
  }

  function invite(partnerId: string) {
    setBusyPartner(partnerId);
    startTransition(async () => {
      const result = await adminAssignPartner({ briefId, partnerId });
      if (result.ok) {
        toast.success("Partner invited");
      } else {
        toast.error("Could not invite");
      }
      setBusyPartner(null);
    });
  }

  return (
    <section
      aria-label="AI-ranked partner sourcing"
      className="rounded-2xl border border-line bg-card overflow-hidden"
    >
      <header className="flex items-center justify-between px-5 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Top partners for this brief</h2>
            <p className="text-[11px] text-muted-foreground">
              Deterministic score · AI-generated rationale
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={rerank}
          disabled={pending}
        >
          <RotateCw className="h-3.5 w-3.5" />
          Re-rank
        </Button>
      </header>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.partnerId} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">
                    {item.partnerName}
                  </h3>
                  <Badge tone="brand" shape="soft" size="sm" uppercase>
                    {item.label}
                  </Badge>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    {item.score}/100
                  </span>
                  {item.confidence != null && (
                    <span className="text-[11px] font-mono tabular-nums text-primary">
                      AI {item.confidence}%
                    </span>
                  )}
                </div>
                {item.rationale && (
                  <p className="mt-1.5 text-[13px] leading-snug text-foreground/90">
                    {item.rationale}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setComposerFor(item)}
                  disabled={pending}
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Compose
                </Button>
                <Button
                  size="sm"
                  onClick={() => invite(item.partnerId)}
                  disabled={pending && busyPartner === item.partnerId}
                >
                  {busyPartner === item.partnerId ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Invite
                </Button>
              </div>
            </div>

            {(item.strengths.length > 0 || item.caveats.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {item.strengths.map((s, i) => (
                  <Badge
                    key={`s-${i}`}
                    tone="success"
                    shape="soft"
                    size="sm"
                  >
                    {s}
                  </Badge>
                ))}
                {item.caveats.map((c, i) => (
                  <Badge
                    key={`c-${i}`}
                    tone="warning"
                    shape="soft"
                    size="sm"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            )}

            {item.reasons.length > 0 && (
              <details className="text-[11.5px] text-muted-foreground">
                <summary className="cursor-pointer">
                  Why this score
                </summary>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {item.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>

      {composerFor && (
        <OutreachComposer
          briefId={briefId}
          partnerId={composerFor.partnerId}
          partnerName={composerFor.partnerName}
          onClose={() => setComposerFor(null)}
        />
      )}
    </section>
  );
}
