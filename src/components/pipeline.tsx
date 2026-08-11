import { Check } from "lucide-react";
import { PIPELINE_STEPS } from "@/lib/constants";
import { stageIndex } from "@/lib/brief";
import type { BriefStage } from "@/lib/enums";
import { cn } from "@/lib/utils";

export function Pipeline({
  stage,
  compact = false,
}: {
  stage: BriefStage;
  compact?: boolean;
}) {
  const idx = stageIndex(stage);

  return (
    <div className="relative w-full pt-4 pb-2">
      <div className="absolute top-[34px] left-[5%] right-[5%] h-[2px] bg-border/60" />
      <div
        className="absolute top-[34px] left-[5%] h-[2px] bg-primary transition-all duration-700 ease-out"
        style={{ width: `${(idx / (PIPELINE_STEPS.length - 1)) * 90}%` }}
      />
      <ol className="relative z-10 flex justify-between">
        {PIPELINE_STEPS.map((step, i) => {
          const done = i < idx;
          const active = i === idx;
          const Icon = step.icon;
          return (
            <li key={step.stage} className={cn("flex flex-col items-center text-center", compact ? "w-16" : "w-28")}>
              <div
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full border-2 transition-all duration-500",
                  done
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_12px_-3px_hsl(var(--primary)/0.35)]"
                    : active
                      ? "border-primary text-primary bg-card ring-4 ring-primary/15 scale-110"
                      : "border-border text-muted-foreground/60 bg-card",
                )}
              >
                {done ? (
                  <Check className="h-5 w-5" strokeWidth={3} />
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                )}
              </div>
              <div
                className={cn(
                  "mt-3 text-xs font-semibold tracking-tight transition-colors duration-300",
                  active
                    ? "text-foreground"
                    : done
                      ? "text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </div>
              {!compact && (
                <div
                  className={cn(
                    "mt-0.5 text-[10px] font-medium transition-opacity duration-300",
                    active ? "opacity-100 text-muted-foreground" : "opacity-0",
                  )}
                >
                  {step.actor === "AI Partner"
                    ? "Our team"
                    : step.actor === "Partners"
                      ? "Partners"
                      : "You"}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
