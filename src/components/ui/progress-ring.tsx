"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Circular progress indicator.
 *
 * Used on brief-list rows (completion %) and the brief-builder side panel.
 * Renders pure SVG — no images, no canvas — so it stays crisp at every
 * resolution and scales with surrounding text colour via currentColor.
 *
 *  • When mounted, the stroke smoothly tweens from 0 → `value` so the ring
 *    "draws" itself. Respects prefers-reduced-motion.
 *  • The optional `label` slot renders the percentage in the centre.
 */
export function ProgressRing({
  value,
  size = 44,
  strokeWidth = 4,
  className,
  trackClassName = "stroke-secondary",
  fillClassName = "stroke-primary",
  showLabel = true,
  label,
}: {
  /** Percentage 0–100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  showLabel?: boolean;
  /** Custom centre label. Defaults to "{value}%". */
  label?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const [animated, setAnimated] = useState(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      setAnimated(clamped);
      return;
    }
    // Frame-bound rAF tween — 600ms, ease-out-expo. Avoids spawning a Framer
    // motion value per ring (we can render dozens at once on lists).
    let raf = 0;
    const start = performance.now();
    const from = animated;
    const to = clamped;
    const dur = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4); // ease-out-quart
      setAnimated(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, reduced]);

  const radius = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c - (animated / 100) * c;

  return (
    <div
      className={cn(
        "relative inline-grid place-items-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-280 ease-out-quart",
            fillClassName,
          )}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute inset-0 grid place-items-center text-[10.5px] font-semibold tabular-nums text-foreground"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {label ?? `${Math.round(animated)}%`}
        </span>
      )}
    </div>
  );
}
