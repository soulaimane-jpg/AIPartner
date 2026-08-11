"use client";
import { useTransition } from "react";
import { Send, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitBriefAction } from "@/lib/actions/briefs";

export function BriefSubmit({
  id,
  completion,
  reviewConfirmed = true,
}: {
  id: string;
  disabled?: boolean;
  completion?: number;
  reviewConfirmed?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const pct = completion ?? 0;

  const title = !reviewConfirmed
    ? "Confirm your internal review & approval workflow below before submitting."
    : pct < 30
      ? `You can submit now — our team or partners will follow up on missing details. (${pct}% captured)`
      : "Submit for partner sourcing";

  const handleClick = () => {
    if (!reviewConfirmed) {
      toast.info("Please confirm your internal review & approval workflow first.");
      document
        .getElementById("review-workflow")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const result = await submitBriefAction({ briefId: id });
      if (!result.ok) {
        const msg =
          result.error.code === "CONFLICT"
            ? (result.error.reason ?? "Cannot submit yet.")
            : result.error.code === "INVALID_INPUT"
              ? (result.error.issues[0]?.message ?? "Invalid input")
              : result.error.code === "FORBIDDEN"
                ? "You don't have permission to submit this brief."
                : "Could not submit";
        toast.error(msg);
        return;
      }
      toast.success("Brief submitted — our team will source partners");
      window.location.assign(`/briefs/${result.data.briefId}/preview`);
    });
  };

  return (
    <Button
      size="sm"
      disabled={pending}
      title={title}
      onClick={handleClick}
      variant={reviewConfirmed ? "default" : "outline"}
    >
      {reviewConfirmed ? (
        <Send className="h-4 w-4" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
      {pending
        ? "Submitting…"
        : reviewConfirmed
          ? "Review & Submit"
          : "Review workflow required"}
    </Button>
  );
}
