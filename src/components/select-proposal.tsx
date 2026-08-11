"use client";
import { useTransition } from "react";
import { Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { selectProposalAction } from "@/lib/actions/proposals";

export function SelectProposalButton({
  briefId,
  proposalId,
  selected,
}: {
  briefId: string;
  proposalId: string;
  selected?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (selected) {
    return (
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled>
        <CheckCheck className="h-4 w-4" /> Selected partner
      </Button>
    );
  }
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (
            !window.confirm(
              "Select this partner? Other proposals will be declined.",
            )
          )
            return;
          const result = await selectProposalAction({ briefId, proposalId });
          if (result.ok) {
            toast.success("Partner selected. Introduction in progress.");
          } else {
            toast.error("Failed to select partner");
          }
        })
      }
    >
      <Check className="h-4 w-4" /> Select partner
    </Button>
  );
}
