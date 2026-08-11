"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { m } from "framer-motion";

/**
 * Animated number that counts up to its target when it scrolls into view.
 *
 * Used on dashboard KPIs and marketing stats. Defaults read well for both
 * integer counts (briefs, partners) and currency-style numbers when a
 * `format` function is supplied.
 *
 * Notes
 * - Uses tabular-nums so digits don't shift width while animating.
 * - Honours prefers-reduced-motion via the global MotionConfig (Framer's
 *   useSpring will collapse to a no-op transition automatically).
 */
export function NumberFlow({
  value,
  duration = 1.4,
  format,
  className,
  prefix = "",
  suffix = "",
  start = 0,
}: {
  value: number;
  /** Animation duration in seconds — translated to spring stiffness internally. */
  duration?: number;
  /** Custom formatter (e.g. for currency / percent). Default: round + locale string. */
  format?: (n: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
  /** Starting value (defaults to 0 — useful when re-animating after a delta). */
  start?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionValue = useMotionValue(start);
  // Stiffness derived from duration so callers think in "seconds, roughly".
  const spring = useSpring(motionValue, {
    stiffness: 110 / Math.max(duration, 0.4),
    damping: 22,
    mass: 0.8,
  });
  const display = useTransform(spring, (n) => {
    const formatted = format ? format(n) : Math.round(n).toLocaleString();
    return `${prefix}${formatted}${suffix}`;
  });
  const [text, setText] = useState(() =>
    format ? format(start) : `${prefix}${Math.round(start).toLocaleString()}${suffix}`,
  );

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => display.on("change", setText), [display]);

  return (
    <m.span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </m.span>
  );
}
