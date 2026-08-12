"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Feedback = {
  overallScore: number;
  verdict: string;
  topStrengths: string[];
  sections: {
    key: string;
    label: string;
    score: number;
    summary: string;
    gaps: { what: string; why: string; askThis: string }[];
  }[];
  nextQuestions: string[];
};

export function BriefFeedbackPanel({
  briefId,
  completion,
  onAskQuestion,
}: {
  briefId: string;
  completion: number;
  onAskQuestion?: (question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Feedback | null>(null);

  const run = async () => {
    setOpen(true);
    if (data) return; // keep cached result
    setLoading(true);
    try {
      const res = await fetch(`/api/briefs/${briefId}/feedback`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setData(json.data as Feedback);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not generate feedback",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={run}
        variant="outline"
        size="sm"
        className="shrink-0 h-9 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{completion >= 70 ? "Review my SoW" : "Get feedback"}</span>
        <span className="sm:hidden">Feedback</span>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--brand-3))] text-white shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    SoW Quality Report
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    AI review of your statement of work
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm">Analyzing your brief…</span>
                </div>
              )}

              {!loading && data && (
                <div className="space-y-6">
                  {/* Overall */}
                  <div className="text-center space-y-3">
                    <ScoreRing score={data.overallScore} />
                    <p className="text-sm font-semibold text-foreground">
                      {data.verdict}
                    </p>
                  </div>

                  {/* Strengths */}
                  {data.topStrengths.length > 0 && (
                    <div className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                      </div>
                      <ul className="space-y-1.5">
                        {data.topStrengths.map((s, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground flex gap-2"
                          >
                            <span className="text-success mt-0.5">●</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sections */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Section scores
                    </div>
                    {data.sections.map((s) => (
                      <SectionCard
                        key={s.key}
                        section={s}
                        onAsk={onAskQuestion}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </div>

                  {/* Next questions */}
                  {data.nextQuestions.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        <TrendingUp className="h-3.5 w-3.5" /> Answer these next
                        to reach 100%
                      </div>
                      <div className="space-y-2">
                        {data.nextQuestions.map((q, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              onAskQuestion?.(q);
                              setOpen(false);
                            }}
                            className="w-full text-left text-sm text-foreground rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all px-3 py-2.5 flex items-start gap-2 group"
                          >
                            <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span className="flex-1">{q}</span>
                            <span className="text-[10px] text-primary font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                              Ask
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-success"
      : score >= 55
        ? "text-warning"
        : "text-muted-foreground";
  const ring =
    score >= 80
      ? "stroke-success"
      : score >= 55
        ? "stroke-warning"
        : "stroke-muted-foreground";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative inline-flex">
      <svg width="110" height="110" viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          className="stroke-secondary"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          className={cn(ring, "transition-all duration-700 ease-out")}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          color,
        )}
      >
        <span className="text-3xl font-bold leading-none">{score}</span>
        <span className="text-[10px] uppercase tracking-widest font-semibold mt-1 text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  onAsk,
  onClose,
}: {
  section: Feedback["sections"][number];
  onAsk?: (q: string) => void;
  onClose: () => void;
}) {
  const tone =
    section.score >= 80
      ? "success"
      : section.score >= 55
        ? "warning"
        : "destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {section.label}
          </div>
          <p className="text-xs text-muted-foreground">{section.summary}</p>
        </div>
        <ScorePill score={section.score} tone={tone} />
      </div>

      {section.gaps.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-3">
          {section.gaps.map((g, i) => (
            <li key={i} className="space-y-1">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <div className="text-xs text-foreground font-medium">
                  {g.what}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground pl-5 leading-relaxed">
                {g.why}
              </div>
              {g.askThis && (
                <button
                  type="button"
                  onClick={() => {
                    onAsk?.(g.askThis);
                    onClose();
                  }}
                  className="ml-5 text-[11px] text-primary hover:underline font-medium"
                >
                  → Ask in chat: &quot;{g.askThis}&quot;
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScorePill({
  score,
  tone,
}: {
  score: number;
  tone: "success" | "warning" | "destructive";
}) {
  const map = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  } as const;
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-bold px-2.5 py-1 rounded-md border tabular-nums",
        map[tone],
      )}
    >
      {score}
    </span>
  );
}
