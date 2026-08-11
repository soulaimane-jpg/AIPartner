"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteFeatureFlagAction } from "@/lib/actions/flags";

export function DeleteFlagButton({ flagKey }: { flagKey: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      title="Delete flag"
      onClick={() => {
        if (
          !confirm(
            `Delete flag "${flagKey}"? This is irreversible — call sites with that key will receive false until re-created.`,
          )
        )
          return;
        startTransition(async () => {
          const result = await deleteFeatureFlagAction({ key: flagKey });
          if (!result.ok) {
            toast.error(
              result.error.code === "FORBIDDEN"
                ? "Only admins can delete flags."
                : "Could not delete flag.",
            );
            return;
          }
          toast.success(`Flag ${flagKey} deleted`);
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  );
}
