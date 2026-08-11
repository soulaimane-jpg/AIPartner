"use client";

import * as React from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lightweight wrapper that fades + translates its children up when they
 * enter the viewport. Used across the landing page for choreographed
 * section entrances. Respects `prefers-reduced-motion` via the global
 * MotionConfig (framer-motion collapses to a no-op transition).
 */
export function ScrollReveal({
  children,
  delay = 0,
  y = 18,
  amount = 0.25,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  amount?: number;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
      className={cn(className)}
    >
      {children}
    </m.div>
  );
}
