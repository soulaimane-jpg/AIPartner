/**
 * Match-score widget — RSC.
 *
 * Renders the deterministic match breakdown for the brief–partner
 * pair via `scorePartnersForBrief`, the same unified entry point the
 * admin sourcing screen uses. That picks the tag-substantiated v2
 * scorer when both sides have structured tags and falls back to the
 * legacy string-overlap score otherwise — so the partner sees exactly
 * the score the platform actually ranked them by, rather than a
 * second, divergent number.
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
import { scorePartnersForBrief } from "@/lib/match-load";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GATE_LABELS: Record<string, string> = {
  budget_below_minimum: "Project is below your minimum engagement size",
  cannot_start_in_time: "Your bench can't start within their timeline",
  missing_required_compliance: "Missing a required compliance credential",
};

const LABEL_TONE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Strong: "bg-emerald-50/70 text-emerald-700 border-emerald-200",
  Fair: "bg-amber-50 text-amber-700 border-amber-200",
  Weak: "border-amber-200 bg-amber-50 text-amber-700",
  Poor: "border-destructive/20 bg-destructive/10 text-destructive",
};

export async function MatchScoreWidget({
  brief,
  partner,
}: {
  brief: ProjectBrief;
  partner: Company & { partnerProfile: PartnerProfile | null };
}) {
  const scored = await scorePartnersForBrief(brief, [partner]);
  const breakdown = scored.get(partner.id);
  if (!breakdown) return null;
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

        {breakdown.gates.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-dashed border-border">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Requirements not met
            </div>
            {breakdown.gates.map((g) => (
              <div
                key={g}
                className="flex items-center justify-between gap-2 text-[11.5px]"
              >
                <span className="text-muted-foreground">
                  {GATE_LABELS[g] ?? g}
                </span>
                <Badge tone="warning" shape="soft" size="sm">
                  blocker
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-dashed border-border text-[11px] text-muted-foreground">
          <span>
            {breakdown.engine === "tags"
              ? "Scored on substantiated capability tags"
              : "Scored on profile keywords — add structured tags for a sharper match"}
          </span>
          {breakdown.substantiated.length > 0 && (
            <Badge tone="neutral" shape="soft" size="sm">
              {breakdown.substantiated.length} substantiated
            </Badge>
          )}
        </div>
      </div>
    </section>
  );
}
