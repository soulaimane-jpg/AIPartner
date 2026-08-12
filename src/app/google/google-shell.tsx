"use client";

import { m } from "framer-motion";
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
  string
> = {
  muted: "border-border bg-secondary text-muted-foreground",
  primary: "border-primary/15 bg-primary/10 text-primary",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
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
    <GoogleSection className="h-full">
      <div className="customer-panel flex h-full items-center justify-between gap-4 p-4 sm:p-5">
        {/* Cursor-tracking glare */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
              t,
            )}
          >
            {icon}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      </div>
    </GoogleSection>
  );
}
