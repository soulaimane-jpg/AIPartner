import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stylised product UI mock for the right side of the hero. Shows a
 * pretend chat conversation between the AI brief assistant and a
 * customer, plus a small progress strip. Pure JSX/CSS — no real
 * screenshot, no real data. The visual is deliberately a touch
 * idealised (think product trailer, not a debugger).
 *
 * Rendered as a rounded white card with a subtle 3-D tilt (`rotateY`
 * + `rotateX`) and an elev-4 shadow. Sits on the dark gradient hero
 * for high contrast.
 */
export function HeroProductMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full max-w-[560px] mx-auto",
        "[transform-style:preserve-3d]",
        className,
      )}
    >
      {/* Soft magenta glow halo behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 blur-3xl opacity-60
          [background:radial-gradient(60%_60%_at_50%_50%,hsl(var(--magenta-glow)/0.55),transparent_70%)]"
      />

      {/* The card */}
      <div
        className={cn(
          "relative bg-white rounded-3xl shadow-elev-4 overflow-hidden",
          "[transform:perspective(1400px)_rotateY(-6deg)_rotateX(2deg)]",
          "transition-transform duration-700 ease-out-expo",
          "hover:[transform:perspective(1400px)_rotateY(-3deg)_rotateX(1deg)]",
        )}
      >
        {/* Window header */}
        <div className="flex items-center gap-2 h-9 px-4 bg-[hsl(36_22%_95%)] border-b border-line">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C940]" />
          </div>
          <div className="flex-1" />
          <span className="text-[11px] font-mono text-muted-foreground tracking-tight">
            aipartner — new brief
          </span>
          <div className="flex-1" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-magenta-1">
            72% complete
          </span>
        </div>

        {/* Conversation area */}
        <div className="px-5 py-5 space-y-3.5 bg-white">
          {/* Assistant message */}
          <div className="flex items-start gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 max-w-[90%]">
              <p className="text-[13px] leading-snug text-foreground">
                What&apos;s the business outcome you&apos;re driving with this migration?
              </p>
            </div>
          </div>

          {/* User message */}
          <div className="flex items-start gap-2.5 justify-end">
            <div className="rounded-2xl rounded-tr-sm bg-[hsl(var(--brand-1))] px-3.5 py-2.5 max-w-[80%] text-white shadow-elev-1">
              <p className="text-[13px] leading-snug">
                We need to cut analytics latency by 60% and retire a legacy Redshift cluster by Q3.
              </p>
            </div>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-white shrink-0">
              You
            </span>
          </div>

          {/* Assistant message */}
          <div className="flex items-start gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 max-w-[90%]">
              <p className="text-[13px] leading-snug text-foreground">
                Got it. I&apos;ve added the KPI and target date. Do you have a preferred GCP region for data residency?
              </p>
            </div>
          </div>

          {/* Composer */}
          <div className="mt-2 flex items-center gap-2 rounded-full border border-line bg-surface-2 pl-4 pr-1 py-1">
            <span className="text-[12.5px] text-subtle truncate flex-1">
              EU-West (multi-region)…
            </span>
            <button
              type="button"
              tabIndex={-1}
              className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-white shrink-0"
              aria-label="Send"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="px-5 py-3 bg-[hsl(36_22%_97%)] border-t border-line">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Brief sections
            </span>
            <span className="text-[10.5px] font-mono text-muted-foreground">
              4 of 6
            </span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-brand-gradient" />
            ))}
            {[4, 5].map((i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-line" />
            ))}
          </div>
        </div>
      </div>

      {/* Floating mini-card accent: "AI suggested 3 partners" */}
      <div
        className={cn(
          "absolute -bottom-6 -left-8 hidden lg:flex items-center gap-2",
          "bg-white rounded-full pl-1.5 pr-4 py-1.5 shadow-elev-3",
          "[transform:perspective(1400px)_rotateY(-2deg)_translateZ(40px)]",
        )}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-magenta-gradient text-white shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[12.5px] font-medium text-foreground whitespace-nowrap">
          3 partners matched
        </span>
      </div>
    </div>
  );
}
