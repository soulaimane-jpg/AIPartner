"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Global motion provider.
 *
 *  • LazyMotion + domAnimation tree-shakes Framer Motion — only the DOM
 *    animation features are loaded, dropping ~25 kB compared to the full
 *    bundle while still supporting every variant we use.
 *  • MotionConfig.reducedMotion="user" honours the OS-level
 *    prefers-reduced-motion setting automatically.
 *  • A single, sensible default transition keeps every animation in the
 *    same rhythm unless a component overrides it explicitly.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
