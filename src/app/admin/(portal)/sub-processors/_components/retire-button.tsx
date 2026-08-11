"use client";

import { useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { retireSubProcessor } from "@/lib/actions/sub-processors";

/**
 * Retire button — soft-deletes a sub-processor.
 *
 * Confirms in a native dialog because retirement triggers a 60-second
 * public visibility change; we want the operator's deliberate intent.
 */
export function RetireButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function onRetire() {
    if (
      !confirm(
        `Retire ${name}? It disappears from /trust within 60 seconds and from /api/v1/sub-processors immediately.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await retireSubProcessor({ id });
      if (!result.ok) {
        toast.error("Couldn't retire.");
        return;
      }
      toast.success(`${name} retired.`);
    });
  }

  return (
    <button
      type="button"
      onClick={onRetire}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      <Archive className="h-3 w-3" />
      Retire
    </button>
  );
}
