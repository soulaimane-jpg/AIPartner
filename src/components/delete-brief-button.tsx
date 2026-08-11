"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteBriefAction } from "@/lib/actions/briefs";

export function DeleteBriefButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this project brief? This cannot be undone.")) return;
        startTransition(async () => {
          const result = await deleteBriefAction({ briefId: id });
          if (!result.ok) {
            toast.error(
              result.error.code === "FORBIDDEN"
                ? "You don't have permission to delete this brief."
                : "Failed to delete",
            );
            return;
          }
          toast.success("Project brief deleted");
        });
      }}
    >
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  );
}
