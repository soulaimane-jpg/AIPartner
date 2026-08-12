"use client";

/**
 * Customer → anonymized partner question, before selection.
 *
 * Clarification threads already existed for triage and QC, but the
 * customer had no way to ask a bidding partner a follow-up about their
 * proposal — so a question that could have decided the comparison
 * either went unasked or forced an early reveal.
 *
 * Anonymity is preserved in both directions: the partner is addressed
 * by placeholder label, and the thread serializer renders the customer
 * to the partner as "The customer".
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClarificationThreadAction } from "@/lib/actions/clarifications";

export function AskPartnerQuestion({
  briefId,
  matchId,
  partnerLabel,
}: {
  briefId: string;
  matchId: string;
  partnerLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    if (body.trim().length < 8) {
      toast.error("Add a bit more detail to your question");
      return;
    }
    startTransition(async () => {
      const result = await createClarificationThreadAction({
        briefId,
        matchId,
        contextType: "proposal_question",
        body: body.trim(),
      });
      if (result.ok) {
        toast.success(`Question sent to ${partnerLabel}`);
        setBody("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(
          "reason" in result.error && result.error.reason
            ? result.error.reason
            : "Could not send your question",
        );
      }
    });
  }

  if (!open) {
    return (
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        <MessageCircleQuestion className="h-3.5 w-3.5" />
        Ask a question
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-1 p-2.5">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={`Ask ${partnerLabel} about their proposal…`}
        className="text-[12.5px]"
      />
      <p className="text-[11px] text-muted-foreground">
        Your identity stays hidden — they see this as coming from
        &ldquo;the customer&rdquo;.
      </p>
      <div className="flex items-center gap-2">
        <Button size="xs" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          Send
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
