/**
 * Shared motion language for AI Partner.
 *
 * Every component that animates should pull variants/transitions from here so
 * the whole app feels choreographed instead of a patchwork of one-off tweens.
 *
 * All variants respect prefers-reduced-motion via the global <MotionConfig
 * reducedMotion="user"> wrapper in app/layout.tsx — Framer will fall back to
 * instantaneous transitions for those users automatically.
 */

import type { Transition, Variants } from "framer-motion";

/* ── Easing curves (mirror the CSS tokens in globals.css) ───────────── */
export const ease = {
  outQuart: [0.22, 1, 0.36, 1] as const,
  outExpo:  [0.16, 1, 0.3, 1] as const,
  spring:   [0.34, 1.56, 0.64, 1] as const,
  emphasis: [0.2,  0,    0,    1] as const,
};

/* ── Standard durations (seconds; mirror --dur-* tokens) ────────────── */
export const dur = {
  d1: 0.10,   // --dur-1  100ms
  d2: 0.16,   // --dur-2  160ms
  d3: 0.24,   // --dur-3  240ms
  d4: 0.36,   // --dur-4  360ms
  d5: 0.60,   // --dur-5  600ms
};

/* ── Reusable transitions ───────────────────────────────────────────── */
export const tSnappy:   Transition = { duration: dur.d1, ease: ease.outQuart };
export const tFast:     Transition = { duration: dur.d2, ease: ease.outQuart };
export const tBase:     Transition = { duration: dur.d3, ease: ease.outQuart };
export const tSlow:     Transition = { duration: dur.d4, ease: ease.outExpo };
export const tCinema:   Transition = { duration: dur.d5, ease: ease.outExpo };
export const tEmphasis: Transition = { duration: dur.d4, ease: ease.emphasis };

/** Springy underline / pill indicators (tabs, nav). */
export const indicatorSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.7,
};

/** Soft spring for cards / popovers. */
export const tSpring: Transition = { type: "spring", stiffness: 320, damping: 28, mass: 0.9 };

/** Slightly heavier spring for sheets / drawers. */
export const sheetSpring: Transition = { type: "spring", stiffness: 240, damping: 30, mass: 1.1 };

/* ── Variants ───────────────────────────────────────────────────────── */

/** Fade + 12px translate-up. The bread-and-butter entrance. */
export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: tBase },
};

/** Same, larger travel — for hero / above-the-fold elements. */
export const fadeUpLg: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { ...tSlow, duration: dur.d5 } },
};

/** Scale-fade for cards or modals. */
export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: tSpring },
};

/** Sequenced stagger for grids / lists. Apply to the parent container. */
export const stagger = (childDelay = 0.06, initialDelay = 0): Variants => ({
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: childDelay,
      delayChildren:   initialDelay,
    },
  },
});

/** Page-level transition for nested layouts using AnimatePresence. */
export const pageTransition: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: dur.d3, ease: ease.outQuart } },
  exit:    { opacity: 0, y: -8, transition: { duration: dur.d2, ease: ease.outQuart } },
};

/** Hover lift used on interactive cards. Feed to motion.div whileHover. */
export const cardLift = {
  rest:  { y: 0,  scale: 1,    boxShadow: "var(--elev-1)" },
  hover: { y: -3, scale: 1.005, boxShadow: "var(--elev-3)", transition: tFast },
};

/* ── More variants ──────────────────────────────────────────────────── */

/** Plain opacity fade. */
export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: tBase },
};

/** Cinematic blur-in for hero text. */
export const blurIn: Variants = {
  hidden:  { opacity: 0, y: 20, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: dur.d5, ease: ease.outExpo },
  },
};

/** Whole-section reveal driven by IntersectionObserver. */
export const scrollReveal: Variants = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: dur.d4, ease: ease.outExpo } },
};

/* ── Drawer / sheet variants ────────────────────────────────────────── */

export const drawerLeft: Variants = {
  hidden:  { x: "-100%" },
  visible: { x: 0, transition: sheetSpring },
  exit:    { x: "-100%", transition: tFast },
};
export const drawerRight: Variants = {
  hidden:  { x: "100%" },
  visible: { x: 0, transition: sheetSpring },
  exit:    { x: "100%", transition: tFast },
};
export const drawerBottom: Variants = {
  hidden:  { y: "100%" },
  visible: { y: 0, transition: sheetSpring },
  exit:    { y: "100%", transition: tFast },
};

/** Dialog body — overlay handles its own fade. */
export const dialogContent: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: tSpring },
  exit:    { opacity: 0, scale: 0.97, y: 4, transition: tFast },
};

/* ── Inline helpers ─────────────────────────────────────────────────── */

/** Common viewport options for whileInView reveals — fires once, slightly
 *  before the element becomes fully visible. */
export const inViewOnce = { once: true, amount: 0.3 } as const;

/** Same as above but for very tall sections (require less of the element
 *  to be visible before triggering). */
export const inViewSection = { once: true, amount: 0.15 } as const;

/* ── Math helpers (used for scroll-tied animations) ─────────────────── */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Linearly remap `v` from [inMin, inMax] to [outMin, outMax], clamped. */
export const mapRange = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => {
  const t = clamp01((v - inMin) / (inMax - inMin));
  return outMin + (outMax - outMin) * t;
};

/** SSR-safe reduced-motion check. Components should still rely on
 *  MotionConfig reducedMotion="user" — this is for non-Framer cases. */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
};
