"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive 3D tilt wrapper for cards. Tracks mouse position inside
 * the element and applies a small perspective rotateX/rotateY to make
 * the card feel like it's leaning toward the cursor. Also tracks
 * pointer position via CSS custom properties (--mx, --my, 0–100%) so
 * children can render a glossy "glare" highlight that follows the
 * cursor.
 *
 * Honours `prefers-reduced-motion` — falls back to a static card.
 */
export function TiltCard({
  children,
  className,
  /** Max rotation in degrees */
  max = 7,
  /** Pass-through element props (e.g. aria) */
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const nx = px * 2 - 1;
      const ny = py * 2 - 1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${-ny * max * 0.6}deg`);
        el.style.setProperty("--ry", `${nx * max}deg`);
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `0deg`);
        el.style.setProperty("--ry", `0deg`);
      });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div
      ref={ref}
      className={cn(
        "group/tilt relative [perspective:1400px] [transform-style:preserve-3d]",
        className,
      )}
      style={{
        // CSS custom-property defaults; children consume via var(--rx) etc.
        "--rx": "0deg",
        "--ry": "0deg",
        "--mx": "50%",
        "--my": "50%",
      } as React.CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}
