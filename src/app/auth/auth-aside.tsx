"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand";

/**
 * Cinema-dark left panel for the auth layout. Mirrors the marketing
 * hero recipe: deep navy + cyan/teal aurora glow, dithered with the
 * SVG-noise overlay so the gradient looks like a high-DPI render
 * rather than a banded CSS sweep.
 *
 * Children fade + slide in on mount via framer-motion. The container
 * stagger spaces the value points by ~70 ms each so the panel comes to
 * life rather than slamming on screen.
 */
export function AuthAside({
  valuePoints,
}: {
  valuePoints: string[];
}) {
  return (
    <aside className="relative isolate hidden lg:flex flex-col justify-between p-14 overflow-hidden bg-hero-purple text-white">
      {/* Aurora glow — slow drifting cyan/blue blobs */}
      <div aria-hidden className="bg-aurora" />
      {/* Hi-res SVG noise dither */}
      <div aria-hidden className="bg-noise" />

      {/* Brand mark — top-left, inverse on dark */}
      <m.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative"
      >
        <Logo size="md" inverse />
      </m.div>

      <div className="relative max-w-md space-y-8">
        <m.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
          }}
          className="space-y-4"
        >
          <m.span
            variants={fadeUp}
            className="inline-block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-magenta-1"
          >
            Cloud sourcing, simplified
          </m.span>
          <m.h2
            variants={fadeUp}
            className="text-[40px] leading-[1.05] font-semibold tracking-[-0.018em] text-white text-balance"
          >
            Find the right GCP partner without the back-and-forth.
          </m.h2>
          <m.p
            variants={fadeUp}
            className="text-[15px] leading-relaxed text-white/65"
          >
            AI Partner connects you with certified Google Cloud delivery partners — scoped, matched, and ready to propose in under 48 hours.
          </m.p>
        </m.div>

        {/* Value points — staggered list */}
        <m.ul
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } },
          }}
          className="space-y-3"
        >
          {valuePoints.map((point) => (
            <m.li
              key={point}
              variants={fadeUp}
              className="flex items-start gap-3 text-[14px] text-white/85"
            >
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--magenta-1)) 0%, hsl(var(--magenta-2)) 100%)",
                }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {point}
            </m.li>
          ))}
        </m.ul>
      </div>

      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55, delay: 1.0 }}
        className="relative flex items-center gap-2 text-[12px] text-white/55"
      >
        <span className="h-1 w-1 rounded-full bg-white/30" />
        © AI Partner · GCP Partner Network
      </m.p>
    </aside>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

/** Re-exported for layout typing convenience. */
export type AuthValuePoint = string;
