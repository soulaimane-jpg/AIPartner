"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveMatchAction, declineMatchAction } from "@/lib/actions/briefs";

export function CustomerMatchActions({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-9 px-4 rounded-lg font-semibold"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await approveMatchAction({ matchId });
            if (!result.ok) {
              toast.error(
                result.error.code === "FORBIDDEN"
                  ? "You don't have permission to approve this match."
                  : result.error.code === "NOT_FOUND"
                    ? "Match not found."
                    : "Approval failed",
              );
              return;
            }
            toast.success("Match approved — SoW shared with partner");
          })
        }
      >
        <Check className="h-4 w-4" /> Approve match
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 px-4 rounded-lg font-semibold"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await declineMatchAction({ matchId });
            if (!result.ok) {
              toast.error(
                result.error.code === "FORBIDDEN"
                  ? "You don't have permission to decline this match."
                  : "Decline failed",
              );
              return;
            }
            toast.success("Match declined");
          })
        }
      >
        <X className="h-4 w-4" /> Decline
      </Button>
    </div>
  );
}
