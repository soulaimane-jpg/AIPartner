"use client";

/**
 * Freshness badge + one-click re-verification.
 *
 * A profile that was accurate 18 months ago is worse than useless — it looks
 * authoritative while being wrong. Showing the quarter it was last confirmed,
 * and making confirmation a single click, is the cheapest way to keep the
 * directory honest without nagging partners into ignoring us.
 */

import { useTransition } from "react";
import { BadgeCheck, CalendarClock, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Freshness } from "@/lib/partner-strength";
import { confirmProfileAccurateAction } from "@/lib/actions/partner-pillars";

export function FreshnessCard({ freshness }: { freshness: Freshness }) {
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const result = await confirmProfileAccurateAction({});
      if (result.ok) toast.success("Profile confirmed as current");
      else toast.error("Could not confirm your profile");
    });
  };

  const tone =
    freshness.state === "fresh"
      ? {
          card: "border-emerald-200 bg-emerald-50/60",
          icon: "text-emerald-700 border-emerald-200",
          Icon: BadgeCheck,
          title: freshness.label ?? "Verified",
          body: "Clients can see this profile was recently confirmed as accurate.",
        }
      : freshness.state === "stale"
        ? {
            card: "border-amber-200 bg-amber-50/70",
            icon: "text-amber-700 border-amber-200",
            Icon: CalendarClock,
            title: `Last confirmed ${freshness.label?.replace("Verified Active: ", "") ?? "a while ago"}`,
            body: "Profiles unconfirmed for over six months rank lower in matching. One click fixes it.",
          }
        : {
            card: "border-line bg-surface-sunk",
            icon: "text-muted-foreground border-line",
            Icon: ShieldQuestion,
            title: "Not yet confirmed",
            body: "Confirm your details are current to earn a verified badge on client-facing views.",
          };

  const { Icon } = tone;

  return (
    <Card className={cn("shadow-none", tone.card)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-white",
              tone.icon,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">
              {tone.title}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              {tone.body}
            </p>
          </div>
        </div>
        <Button
          onClick={confirm}
          disabled={pending}
          variant={freshness.state === "fresh" ? "outline" : "default"}
          className="h-10 shrink-0 bg-card font-semibold data-[variant=default]:bg-primary"
        >
          {pending ? "Confirming…" : "Confirm still accurate"}
        </Button>
      </CardContent>
    </Card>
  );
}
