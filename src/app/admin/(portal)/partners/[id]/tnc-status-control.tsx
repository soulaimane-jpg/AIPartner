"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { adminSetPartnerTncStatusAction } from "@/lib/actions/partner-admin";
import { mapErrorToToast } from "@/lib/schemas/errors";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "not_sent", label: "Not sent" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
] as const;

/** M5.3 — admin T&C status tracking per partner. */
export function TncStatusControl({
  companyId,
  current,
}: {
  companyId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const set = (tncStatus: (typeof STATUSES)[number]["value"]) => {
    if (tncStatus === current) return;
    setError(null);
    startTransition(async () => {
      const result = await adminSetPartnerTncStatusAction({
        companyId,
        tncStatus,
      });
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error));
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={pending}
            onClick={() => set(s.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[12.5px] transition-colors",
              current === s.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground hover:bg-secondary/60",
            )}
          >
            {s.label}
          </button>
        ))}
        {pending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
        )}
      </div>
      {error && (
        <p className="text-[12.5px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
