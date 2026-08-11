"use client";

/**
 * NPS prompt — 0–10 score row + optional free-text follow-up.
 *
 * Dismissable per-surface (localStorage keyed by surface + briefId).
 * The dismissal isn't persistent across users; that's the platform
 * deliberately erring towards "ask again later" rather than burying
 * the survey.
 *
 * The submit Server Action is `submitNpsResponseAction` — see
 * `@/lib/actions/nps`. The category derivation lives server-side so
 * we can never end up with a mismatched score/category.
 */

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { submitNpsResponseAction } from "@/lib/actions/nps";
import { cn } from "@/lib/utils";

type Surface =
  | "customer.intro"
  | "customer.proposal-picked"
  | "partner.engagement"
  | "googler.referral-closed";

function dismissalKey(surface: Surface, briefId?: string | null): string {
  return `nps:dismiss:${surface}${briefId ? `:${briefId}` : ""}`;
}

export function NpsPrompt({
  surface,
  briefId,
  question = "How likely are you to recommend AI Partner to a peer?",
}: {
  surface: Surface;
  briefId?: string | null;
  question?: string;
}) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(dismissalKey(surface, briefId)) === "1";
  });
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(dismissalKey(surface, briefId), "1");
    }
    setDismissed(true);
  }

  function submit() {
    if (score == null) {
      toast.error("Pick a score first");
      return;
    }
    startTransition(async () => {
      const result = await submitNpsResponseAction({
        score,
        surface,
        briefId: briefId ?? undefined,
        comment: comment.trim() || undefined,
      });
      if (result.ok) {
        toast.success("Thanks — appreciate it");
        dismiss();
      } else {
        toast.error("Could not submit. Try again later.");
      }
    });
  }

  return (
    <aside
      aria-label="Net Promoter Score prompt"
      className="rounded-2xl border border-line bg-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Star className="h-3 w-3" />
            Quick check
          </div>
          <p className="text-[14px] font-medium leading-snug">{question}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          Not now
        </button>
      </div>

      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setScore(i)}
            aria-label={`Score ${i}`}
            className={cn(
              "h-9 rounded-md border text-[13px] font-medium tabular-nums",
              "transition-colors duration-100",
              score === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-border-strong",
            )}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Not at all</span>
        <span>Extremely likely</span>
      </div>

      {score != null && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              score <= 6
                ? "What would have made this a 10?"
                : score <= 8
                  ? "What's keeping it from a 9 or 10?"
                  : "What do we get right? (optional)"
            }
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
