"use client";

import { m } from "framer-motion";
import { TiltCard } from "@/components/marketing/tilt-card";
import { cn } from "@/lib/utils";

/**
 * Animated container + KPI card primitive for the Google Sales portal.
 * Mirrors the marketing landing page motion: staggered fade/slide entrance
 * and TiltCard cursor-tracking 3-D tilt with a cyan glare highlight.
 */
export function GoogleShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export function GoogleSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <m.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
        },
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}

const TONE_STYLES: Record<
  "muted" | "primary" | "success" | "warning",
  { tile: string; glow: string }
> = {
  muted:   { tile: "bg-secondary text-muted-foreground",            glow: "hsl(var(--magenta-1) / 0.10)" },
  primary: { tile: "bg-magenta-1/12 text-magenta-1",                glow: "hsl(var(--magenta-1) / 0.18)" },
  success: { tile: "bg-emerald-500/12 text-emerald-600",            glow: "hsl(150 80% 45% / 0.16)" },
  warning: { tile: "bg-amber-500/12 text-amber-600",                glow: "hsl(38 95% 55% / 0.18)" },
};

export function GoogleKpi({
  icon,
  label,
  value,
  tone,
}: {
  /**
   * Pre-rendered icon node (e.g. `<Send className="h-4 w-4" />`).
   *
   * Lucide icons are React.forwardRef objects with non-serialisable
   * methods, so passing the *component itself* across the RSC boundary
   * crashes Next.js 15+. The render-on-server-pass-node pattern keeps
   * GoogleKpi a client component (it needs TiltCard / framer-motion)
   * while making it RSC-friendly.
   */
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "muted" | "primary" | "success" | "warning";
}) {
  const t = TONE_STYLES[tone];
  return (
    <GoogleSection>
      <TiltCard className="h-full" max={6}>
        <div
          className={cn(
            "group/kpi relative h-full rounded-2xl border border-border bg-white p-5 overflow-hidden",
            "[transform:rotateX(var(--rx))_rotateY(var(--ry))]",
            "[transform-style:preserve-3d]",
            "transition-[box-shadow,transform] duration-240 ease-out-quart",
            "hover:shadow-elev-3",
          )}
        >
          {/* Cursor-tracking glare */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/kpi:opacity-100"
            style={{
              background: `radial-gradient(180px 180px at var(--mx) var(--my), ${t.glow}, transparent 70%)`,
            }}
          />
          <div className="relative flex items-center justify-between">
            <div
              className={cn("grid h-9 w-9 place-items-center rounded-lg", t.tile)}
              style={{ transform: "translateZ(22px)" }}
            >
              {icon}
            </div>
            <div
              className="text-2xl font-bold tabular-nums text-foreground"
              style={{ transform: "translateZ(14px)" }}
            >
              {value}
            </div>
          </div>
          <div className="relative mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        </div>
      </TiltCard>
    </GoogleSection>
  );
}
