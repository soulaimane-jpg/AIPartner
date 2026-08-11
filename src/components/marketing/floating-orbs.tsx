"use client";

import * as React from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Decorative floating 3D-feeling orbs for the hero. Pure CSS + framer
 * motion (no react-three-fiber, no canvas). Each orb is an absolutely
 * positioned div with a layered radial gradient that gives it a
 * pseudo-spherical shading; framer's continuous y/x animations make
 * them drift like balloons.
 *
 * Mouse parallax shifts the whole layer slightly so the orbs feel
 * anchored to a 3D scene the user is "looking through."
 *
 * Reduced-motion users get a static layout.
 */
type Orb = {
  /** Diameter in px (relative to a 600 design viewport — auto-scales). */
  size: number;
  /** Position in % of the parent (top, left). */
  top: string;
  left: string;
  /** Rough z-depth (0 .. 1) — drives parallax + opacity + blur. */
  depth: number;
  /** Color preset. */
  hue: "magenta" | "blue" | "electric" | "cyan" | "teal" | "amber" | "white";
  /** Float-loop seconds. */
  duration: number;
  /** Float-loop offset seconds. */
  delay: number;
};

const ORBS: Orb[] = [
  { size: 120, top: "6%",  left: "80%",  depth: 0.92, hue: "cyan",     duration: 9.5,  delay: 0   },
  { size: 70,  top: "62%", left: "92%",  depth: 0.68, hue: "electric", duration: 8.0,  delay: 1.2 },
  { size: 38,  top: "30%", left: "40%",  depth: 0.40, hue: "white",    duration: 6.5,  delay: 0.4 },
  { size: 26,  top: "84%", left: "30%",  depth: 0.55, hue: "teal",     duration: 7.5,  delay: 2.0 },
  { size: 82,  top: "78%", left: "58%",  depth: 0.78, hue: "blue",     duration: 10.5, delay: 0.6 },
  { size: 20,  top: "12%", left: "16%",  depth: 0.32, hue: "white",    duration: 5.5,  delay: 1.6 },
  { size: 44,  top: "44%", left: "74%",  depth: 0.58, hue: "cyan",     duration: 11.5, delay: 1.8 },
];

const HUE_GRADIENT: Record<Orb["hue"], string> = {
  // "magenta" slot kept for back-compat with the type union — recolored to bright cyan
  magenta:  "radial-gradient(circle at 32% 28%, hsl(184 95% 80%) 0%, hsl(188 92% 48%) 45%, hsl(194 80% 22%) 100%)",
  cyan:     "radial-gradient(circle at 32% 28%, hsl(184 95% 82%) 0%, hsl(188 92% 50%) 45%, hsl(194 80% 22%) 100%)",
  teal:     "radial-gradient(circle at 32% 28%, hsl(180 80% 75%) 0%, hsl(184 80% 38%) 45%, hsl(192 78% 18%) 100%)",
  blue:     "radial-gradient(circle at 32% 28%, hsl(212 90% 78%) 0%, hsl(212 88% 48%) 45%, hsl(220 75% 24%) 100%)",
  electric: "radial-gradient(circle at 32% 28%, hsl(205 100% 80%) 0%, hsl(205 95% 56%) 45%, hsl(212 82% 28%) 100%)",
  amber:    "radial-gradient(circle at 32% 28%, hsl(40 100% 80%) 0%, hsl(38 95% 55%) 45%, hsl(28 90% 35%) 100%)",
  white:    "radial-gradient(circle at 32% 28%, hsl(0 0% 100%) 0%, hsl(200 30% 92%) 50%, hsl(200 15% 72%) 100%)",
};

export function FloatingOrbs({ className }: { className?: string }) {
  const layerRef = React.useRef<HTMLDivElement | null>(null);

  // Mouse-driven parallax — translate layer ±18px max
  React.useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${x * 18}px`);
        el.style.setProperty("--my", `${y * 12}px`);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [perspective:1400px]",
        className,
      )}
      style={{
        // CSS variables consumed below for parallax
        "--mx": "0px",
        "--my": "0px",
      } as React.CSSProperties}
    >
      {ORBS.map((o, i) => (
        <m.span
          key={i}
          initial={{ y: 0, x: 0 }}
          animate={{
            y: [0, -10 - o.depth * 10, 0],
            x: [0, 6 - o.depth * 4, 0],
          }}
          transition={{
            duration: o.duration,
            delay: o.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            background: HUE_GRADIENT[o.hue],
            opacity: 0.55 + o.depth * 0.35,
            filter: `blur(${(1 - o.depth) * 2.4}px)`,
            boxShadow: `
              0 ${o.size * 0.2}px ${o.size * 0.5}px hsl(0 0% 0% / ${0.35 * o.depth}),
              inset 0 ${o.size * 0.08}px ${o.size * 0.18}px hsl(0 0% 100% / 0.25)
            `,
            transform: `translate3d(calc(var(--mx) * ${o.depth}), calc(var(--my) * ${o.depth}), 0)`,
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        />
      ))}

      {/* Decorative wireframe rings — add 3D depth to the scene */}
      <m.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute right-[-80px] top-[10%] w-[440px] h-[440px] rounded-full"
        style={{
          border: "1px dashed hsl(0 0% 100% / 0.18)",
          transform: "rotateX(70deg)",
          transformStyle: "preserve-3d",
        }}
      />
      <m.div
        animate={{ rotate: -360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        className="absolute right-[-40px] top-[20%] w-[360px] h-[360px] rounded-full"
        style={{
          border: "1px dashed hsl(205 100% 75% / 0.28)",
          transform: "rotateX(72deg) rotateY(-12deg)",
          transformStyle: "preserve-3d",
        }}
      />
      <m.div
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        className="absolute left-[-120px] bottom-[-60px] w-[420px] h-[420px] rounded-full"
        style={{
          border: "1px dashed hsl(188 92% 70% / 0.22)",
          transform: "rotateX(68deg) rotateY(8deg)",
          transformStyle: "preserve-3d",
        }}
      />
    </div>
  );
}
