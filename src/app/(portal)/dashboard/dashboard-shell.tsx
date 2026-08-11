"use client";

import { m } from "framer-motion";
import { TiltCard } from "@/components/marketing/tilt-card";
import { cn } from "@/lib/utils";

/**
 * Animated container for the Customer Dashboard. Wraps the page in a
 * staggered fade/slide entrance and exposes a `<DashStat />` primitive
 * that uses TiltCard for the same cursor-tracking 3D feel as the
 * marketing landing page.
 */
export function DashShell({
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
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}

export function DashSection({
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

export function DashStat({
  icon,
  label,
  value,
  emphasize,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <DashSection>
      <TiltCard className="h-full" max={6}>
        <div
          className={cn(
            "group/stat relative h-full bg-white rounded-2xl shadow-elev-1 p-5 overflow-hidden",
            "[transform:rotateX(var(--rx))_rotateY(var(--ry))]",
            "[transform-style:preserve-3d]",
            "transition-[box-shadow,transform] duration-240 ease-out-quart",
            "hover:shadow-elev-3",
          )}
        >
          {/* Cursor-tracking gloss */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/stat:opacity-100"
            style={{
              background:
                "radial-gradient(160px 160px at var(--mx) var(--my), hsl(var(--magenta-1) / 0.10), transparent 70%)",
            }}
          />
          <div className="relative flex items-center gap-4">
            <div
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg",
                emphasize
                  ? "bg-magenta-1/12 text-magenta-1"
                  : "bg-secondary text-muted-foreground",
              )}
              style={{ transform: "translateZ(20px)" }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] text-muted-foreground">{label}</div>
              <div
                className="text-2xl font-semibold tracking-tight tabular-nums"
                style={{ transform: "translateZ(14px)" }}
              >
                {value}
              </div>
            </div>
          </div>
        </div>
      </TiltCard>
    </DashSection>
  );
}
