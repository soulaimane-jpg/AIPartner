"use client";

/**
 * Inline answer form for a single anonymous partner question.
 *
 * Renders as a compact textarea + submit button. On success the page
 * is re-validated server-side, so the question card flips from
 * "pending" → "answered" automatically.
 */

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { answerQuestion } from "@/lib/actions/qa";

const MAX = 4_000;

export function QaAnswerForm({
  briefId,
  questionId,
}: {
  briefId: string;
  questionId: string;
}) {
  const [answer, setAnswer] = React.useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = answer.trim();
    if (trimmed.length === 0) {
      toast.error("Write an answer first.");
      return;
    }
    startTransition(async () => {
      const result = await answerQuestion({
        briefId,
        questionId,
        answer: trimmed,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "CONFLICT"
            ? `Already ${result.error.reason ?? "resolved"}.`
            : "Couldn't post the answer.",
        );
        return;
      }
      setAnswer("");
      toast.success("Answer published.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder="Visible to all partners on this brief…"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {answer.length}/{MAX}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          {pending ? "Posting…" : "Post answer"}
        </button>
      </div>
    </form>
  );
}
