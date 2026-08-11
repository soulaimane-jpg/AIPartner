"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleFeatureFlagAction } from "@/lib/actions/flags";

export function FlagToggle({
  flagKey,
  enabled,
}: {
  flagKey: string;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onCheckedChange={(next) => {
        startTransition(async () => {
          const result = await toggleFeatureFlagAction({
            key: flagKey,
            enabled: next,
            reason: `${next ? "Enabled" : "Disabled"} via admin toggle`,
          });
          if (!result.ok) {
            toast.error(
              result.error.code === "FORBIDDEN"
                ? "Only admins can toggle flags."
                : result.error.code === "RATE_LIMITED"
                  ? "Toggling too fast — slow down."
                  : "Could not toggle flag.",
            );
            return;
          }
          toast.success(`${flagKey} ${next ? "enabled" : "disabled"}`);
        });
      }}
    />
  );
}
