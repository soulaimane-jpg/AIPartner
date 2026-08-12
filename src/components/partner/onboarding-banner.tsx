import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

/**
 * Persistent nudge for partners who skipped or abandoned onboarding.
 *
 * The wizard is skippable by design — blocking the portal entirely would be
 * hostile to a partner who signed in to answer an urgent brief. This banner is
 * the trade: they get in, but the cost of an incomplete profile stays visible
 * and quantified rather than buried.
 */
export function OnboardingBanner({
  score,
  nextBestAction,
  missingRequiredCount,
}: {
  score: number;
  nextBestAction: string | null;
  missingRequiredCount: number;
}) {
  return (
    <Card className="border-primary/25 bg-primary/5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-card text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-[13.5px] font-semibold text-foreground">
              {missingRequiredCount > 0
                ? `Finish your profile — ${missingRequiredCount} required answer${missingRequiredCount === 1 ? "" : "s"} left`
                : "Your profile is ready to publish"}
            </h2>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {nextBestAction ??
                "Publish to appear in client matching with a verified badge."}
            </p>
            <div className="flex items-center gap-2.5">
              <Progress value={score} className="h-1.5 max-w-[240px]" />
              <span className="text-[11.5px] font-semibold tabular-nums text-primary">
                {score}%
              </span>
            </div>
          </div>
        </div>
        <Button asChild className="h-10 shrink-0 font-semibold">
          <Link href="/partner/onboarding">
            Continue setup <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
