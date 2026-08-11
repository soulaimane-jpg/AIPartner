"use client";

/**
 * Form for a partner to ask an anonymous question about a brief.
 *
 * The visibility toggle lets the asker keep a private clarification
 * thread ("asker-only") or share with all matched partners
 * ("all-partners"). Default is shared — that produces the best
 * collective intelligence for the customer.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { MessageCirclePlus } from "lucide-react";
import { askQuestion } from "@/lib/actions/qa";

const MAX = 1_000;

export function QaAskForm({ briefId }: { briefId: string }) {
  const [question, setQuestion] = React.useState("");
  const [visibility, setVisibility] = React.useState<
    "all-partners" | "asker-only"
  >("all-partners");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 8) {
      toast.error("Question is too short — give the customer some context.");
      return;
    }
    startTransition(async () => {
      const result = await askQuestion({
        briefId,
        question: trimmed,
        visibility,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "RATE_LIMITED"
            ? "Slow down — too many questions in a short window."
            : "Couldn't post the question.",
        );
        return;
      }
      setQuestion("");
      toast.success("Question posted. The customer will be notified.");
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border bg-muted/20 p-3"
    >
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder="What would you like to clarify with the customer? Your identity stays anonymous."
        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={visibility === "asker-only"}
            onChange={(e) =>
              setVisibility(e.target.checked ? "asker-only" : "all-partners")
            }
            className="h-3.5 w-3.5"
          />
          Keep private (visible to only you + the customer)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground tabular-nums">
            {question.length}/{MAX}
          </span>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <MessageCirclePlus className="h-3 w-3" />
            {pending ? "Posting…" : "Ask anonymously"}
          </button>
        </div>
      </div>
    </form>
  );
}
