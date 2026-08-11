/**
 * Match-score widget — RSC.
 *
 * Renders the deterministic match breakdown for the brief–partner
 * pair. Pure server: takes the brief + partner, calls `computeMatch`,
 * formats the breakdown.
 *
 * Used in the partner inbox detail page so the partner can see *why*
 * AI Partner matched them. Surfacing the reasoning (a) calms the
 * "why was I picked?" anxiety, (b) gives the partner ammunition for
 * their own pitch, (c) closes the explainability loop on AI matching.
 */

import type {
  ProjectBriefRow as ProjectBrief,
  CompanyRow as Company,
  PartnerProfileRow as PartnerProfile,
} from "@/lib/db/rows";
import { Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";
import { computeMatch } from "@/lib/match-score";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABEL_TONE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Strong: "bg-emerald-50/70 text-emerald-700 border-emerald-200",
  Fair: "bg-amber-50 text-amber-700 border-amber-200",
  Weak: "bg-orange-50 text-orange-700 border-orange-200",
  Poor: "bg-rose-50 text-rose-700 border-rose-200",
};

export function MatchScoreWidget({
  brief,
  partner,
}: {
  brief: ProjectBrief;
  partner: Company & { partnerProfile: PartnerProfile | null };
}) {
  const breakdown = computeMatch({ brief, partner });
  const tone = LABEL_TONE[breakdown.label] ?? LABEL_TONE.Fair;
  const Icon = breakdown.score >= 70 ? ShieldCheck : ShieldAlert;

  return (
    <section
      aria-label="Match score"
      className="rounded-2xl border border-line bg-card overflow-hidden"
    >
      <header className="px-4 py-3 border-b border-line flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Why we picked you</h2>
          <p className="text-[11px] text-muted-foreground">
            Deterministic matching score · auditable
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-mono tabular-nums border",
            tone,
          )}
        >
          <Icon className="h-3 w-3" />
          {breakdown.score}/100 · {breakdown.label}
        </span>
      </header>

      <div className="px-4 py-3 space-y-3">
        {breakdown.reasons.length > 0 && (
          <ul className="space-y-1.5">
            {breakdown.reasons.map((r, i) => (
              <li
                key={i}
                className="text-[13px] leading-snug flex gap-2 items-start"
              >
                <span className="text-primary mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-border">
          {Object.entries(breakdown.components).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-[11.5px]">
              <span className="capitalize text-muted-foreground">{key}</span>
              <Badge tone="neutral" shape="soft" size="sm">
                +{value.score}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
