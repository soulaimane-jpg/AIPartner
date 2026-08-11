"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, TrendingUp, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { adminAssignPartner } from "@/lib/actions/admin";

type ScoredPartner = {
  id: string;
  name: string;
  tagline?: string | null;
  score: number;
  label: string;
  reasons: string[];
  matchedSpecs: string[];
  missingSpecs: string[];
  assigned: boolean;
};

export function AdminPartnerMatchList({
  briefId,
  partners,
}: {
  briefId: string;
  partners: ScoredPartner[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...partners].sort((a, b) => b.score - a.score),
    [partners],
  );

  const assign = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      const result = await adminAssignPartner({ briefId, partnerId: id });
      if (result.ok) {
        toast.success("Partner assigned — customer notified for approval");
      } else {
        toast.error("Could not assign partner");
      }
      setPendingId(null);
    });
  };

  if (sorted.length === 0) {
    return (
      <div className="py-10 text-center border border-dashed border-border rounded-xl text-sm text-muted-foreground">
        No partners in the network yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <div
          key={p.id}
          className={cn(
            "rounded-xl border bg-white p-4 transition-all",
            p.assigned
              ? "border-success/30 bg-success/5"
              : "border-border hover:border-primary/30",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-foreground truncate">
                  {p.name}
                </h4>
                <MatchBadge score={p.score} label={p.label} />
                {p.assigned && (
                  <Badge variant="success">
                    <Check className="h-3 w-3" /> Assigned
                  </Badge>
                )}
              </div>
              {p.tagline && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {p.tagline}
                </p>
              )}

              {/* Score bar */}
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    p.score >= 65
                      ? "bg-success"
                      : p.score >= 45
                        ? "bg-warning"
                        : "bg-muted-foreground/40",
                  )}
                  style={{ width: `${p.score}%` }}
                />
              </div>

              {/* Reasons */}
              {p.reasons.length > 0 && (
                <ul className="mt-2.5 space-y-0.5">
                  {p.reasons.map((r, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                    >
                      <TrendingUp className="h-3 w-3 text-primary/70 mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Matched specializations */}
              {p.matchedSpecs.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {p.matchedSpecs.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {!p.assigned && (
              <Button
                size="sm"
                onClick={() => assign(p.id)}
                disabled={pendingId === p.id}
                className="h-8 px-3 text-xs shrink-0"
              >
                {pendingId === p.id ? (
                  "Assigning…"
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Propose
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchBadge({ score, label }: { score: number; label: string }) {
  const tone =
    score >= 65
      ? "success"
      : score >= 45
        ? "warning"
        : "muted";
  return (
    <Badge variant={tone}>
      {score}% · {label}
    </Badge>
  );
}
