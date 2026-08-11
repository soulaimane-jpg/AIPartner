"use client";

import * as React from "react";
import { m } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bespoke illustrations for the alternating feature rows on the landing
 * page. No outer gradient frame — the actual product-UI mock sits
 * directly on the section background, at a larger scale, with 3D tilt
 * + scroll-tied entrance animation + mouse-parallax depth.
 *
 * Each illustration exposes its content through an <IllustrationTilt>
 * wrapper that applies a CSS perspective + rotateX/rotateY driven by
 * cursor position, so the element feels like it's floating in space.
 */

/* ─────────────────────────────────────────────────────────────────
   Shared tilt wrapper — perspective + cursor-driven rotation
   ───────────────────────────────────────────────────────────── */
function IllustrationTilt({
  children,
  className,
  /** Max rotation in degrees at the edge of the element */
  max = 8,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
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
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);
      const ry = Math.max(-1, Math.min(1, nx)) * max;
      const rx = Math.max(-1, Math.min(1, -ny)) * (max * 0.6);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${rx}deg`);
        el.style.setProperty("--ry", `${ry}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `0deg`);
        el.style.setProperty("--ry", `-6deg`);
      });
    };

    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative [perspective:1600px] [transform-style:preserve-3d]",
        className,
      )}
      style={{
        "--rx": "0deg",
        "--ry": "-6deg",
      } as React.CSSProperties}
    >
      <m.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full [transform:rotateX(var(--rx))_rotateY(var(--ry))] [transform-style:preserve-3d] transition-[transform] duration-300 ease-out-quart will-change-transform"
      >
        {children}
      </m.div>
    </div>
  );
}

/* Small floating badge used as a secondary 3D element */
function FloatBadge({
  className,
  depth = 40,
  children,
}: {
  className?: string;
  depth?: number;
  children: React.ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "absolute bg-white rounded-2xl shadow-elev-3 px-3.5 py-2 flex items-center gap-2",
        "[transform-style:preserve-3d]",
        className,
      )}
      style={{ transform: `translateZ(${depth}px)` }}
    >
      {children}
    </m.div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   #1 — Intelligent scoping: chat snippet, bigger, floating free
   ────────────────────────────────────────────────────────────────── */
export function ScopingIllu() {
  return (
    <IllustrationTilt className="w-full max-w-[560px] mx-auto py-6">
      {/* Soft blue glow halo behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 blur-3xl opacity-70
          [background:radial-gradient(55%_55%_at_50%_50%,hsl(var(--brand-3)/0.35),transparent_70%)]"
      />

      <div className="relative bg-white rounded-3xl shadow-elev-4 overflow-hidden">
        {/* Window header */}
        <div className="flex items-center gap-2 h-10 px-4 bg-[hsl(36_22%_95%)] border-b border-line">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C940]" />
          </div>
          <div className="flex-1" />
          <span className="text-[11.5px] font-mono text-muted-foreground tracking-tight">
            aipartner — new brief
          </span>
          <div className="flex-1" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-magenta-1">
            72% complete
          </span>
        </div>

        {/* Conversation */}
        <div className="px-6 py-6 space-y-4">
          <ChatBubble variant="assistant">
            What&apos;s the business outcome you&apos;re driving with this migration?
          </ChatBubble>
          <ChatBubble variant="user">
            Cut analytics latency by 60% and retire a legacy Redshift cluster by Q3.
          </ChatBubble>
          {/* Typing */}
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 inline-flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-magenta-1 animate-pulse-dot"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          </div>
          {/* Progress strip */}
          <div className="pt-3 border-t border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Brief sections
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                4 of 6
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <m.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="h-1.5 flex-1 rounded-full bg-brand-gradient origin-left"
                />
              ))}
              <div className="h-1.5 flex-1 rounded-full bg-line" />
              <div className="h-1.5 flex-1 rounded-full bg-line" />
            </div>
          </div>
        </div>
      </div>

      <FloatBadge className="-bottom-5 -left-6" depth={60}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-magenta-gradient text-white shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[12.5px] font-medium text-foreground whitespace-nowrap">
          15 min to complete
        </span>
      </FloatBadge>
    </IllustrationTilt>
  );
}

function ChatBubble({
  variant,
  children,
}: {
  variant: "assistant" | "user";
  children: React.ReactNode;
}) {
  if (variant === "assistant") {
    return (
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1 rounded-2xl rounded-tl-sm bg-secondary px-4 py-2.5 max-w-[90%]">
          <p className="text-[14px] leading-snug text-foreground">{children}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 justify-end">
      <div className="rounded-2xl rounded-tr-sm bg-brand-gradient px-4 py-2.5 max-w-[82%] text-white shadow-elev-1">
        <p className="text-[14px] leading-snug">{children}</p>
      </div>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-[11.5px] font-semibold text-white shrink-0">
        You
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   #2 — Smart matching: 3 partner cards floating in a loose grid
   ────────────────────────────────────────────────────────────────── */
export function MatchingIllu() {
  type Partner = {
    name: string;
    region: string;
    tier: string;
    lit: boolean;
    initials: string;
    /** Card offset from layout centre, in px; drives the 3D scatter */
    dx: number;
    dy: number;
    dz: number;
    rot: number;
  };

  const partners: Partner[] = [
    { name: "Cumulus Cloud", region: "EU-West",  tier: "Premier", initials: "CC", lit: false, dx: -120, dy: -90, dz:  10, rot: -5 },
    { name: "Northwind",     region: "US-East",  tier: "Premier", initials: "NW", lit: true,  dx:   30, dy:  -8, dz:  50, rot:  2 },
    { name: "Voyage Labs",   region: "EU-North", tier: "Select",  initials: "VL", lit: false, dx: -100, dy:  80, dz:  20, rot:  6 },
    { name: "Kite Systems",  region: "APAC",     tier: "Select",  initials: "KS", lit: false, dx:  110, dy:  90, dz:  30, rot: -4 },
  ];

  return (
    <IllustrationTilt className="w-full max-w-[560px] mx-auto aspect-[5/4]" max={10}>
      {/* Soft blue glow halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 blur-3xl opacity-70
          [background:radial-gradient(55%_55%_at_50%_50%,hsl(var(--brand-3)/0.32),transparent_70%)]"
      />

      {/* Background connection lattice */}
      <svg
        aria-hidden
        viewBox="0 0 500 400"
        className="absolute inset-0 w-full h-full opacity-60"
      >
        <defs>
          <linearGradient id="lattice-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stopColor="hsl(var(--brand-3))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--magenta-1))" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <m.g
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <path d="M130 110 L280 190" stroke="url(#lattice-stroke)" strokeWidth="1.2" strokeDasharray="4 3" fill="none" />
          <path d="M150 290 L280 190" stroke="url(#lattice-stroke)" strokeWidth="1.2" strokeDasharray="4 3" fill="none" />
          <path d="M370 300 L280 190" stroke="url(#lattice-stroke)" strokeWidth="1.2" strokeDasharray="4 3" fill="none" />
        </m.g>
      </svg>

      {/* Partner cards — scattered at different z-depths.
          Outer div carries the per-card translate (framer can't touch it);
          inner m.div animates only opacity for the entrance. */}
      <div className="relative w-full h-full">
        {partners.map((p, i) => (
          <div
            key={p.name}
            className="absolute left-1/2 top-1/2 w-[240px] [transform-style:preserve-3d]"
            style={{
              transform: `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) translateZ(${p.dz}px) rotate(${p.rot}deg)`,
            }}
          >
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.1 }}
              className={cn(
                "rounded-2xl bg-white px-4 py-3",
                p.lit
                  ? "shadow-elev-4 ring-2 ring-magenta-1"
                  : "shadow-elev-3 ring-1 ring-line",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold text-white shrink-0 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]",
                    p.lit ? "bg-magenta-gradient" : "bg-brand-gradient",
                  )}
                >
                  {p.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-tight text-foreground truncate">
                    {p.name}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {p.region} · {p.tier}
                  </div>
                </div>
                {p.lit && (
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-magenta-1 shrink-0 inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-magenta-1 animate-pulse-dot" />
                    Top
                  </span>
                )}
              </div>
              {/* Compact match bars */}
              <div className="mt-2.5 flex gap-1">
                {[0, 1, 2, 3, 4].map((j) => {
                  const fills = p.lit ? 5 : p.initials === "CC" ? 4 : p.initials === "VL" ? 3 : 3;
                  return (
                    <div
                      key={j}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        j < fills
                          ? p.lit ? "bg-magenta-1" : "bg-brand-3"
                          : "bg-line",
                      )}
                    />
                  );
                })}
              </div>
            </m.div>
          </div>
        ))}
      </div>
    </IllustrationTilt>
  );
}

/* ──────────────────────────────────────────────────────────────────
   #3 — Proposal compare: big side-by-side table
   ────────────────────────────────────────────────────────────────── */
export function CompareIllu() {
  const rows: { label: string; a: string; b: string; winner: "a" | "b" }[] = [
    { label: "Cost",     a: "$1.2M",   b: "$0.94M", winner: "b" },
    { label: "Timeline", a: "16 wks",  b: "12 wks", winner: "b" },
    { label: "Team",     a: "8 FTE",   b: "6 FTE",  winner: "b" },
    { label: "Risk",     a: "Medium",  b: "Low",    winner: "b" },
    { label: "CSAT",     a: "4.4 / 5", b: "4.7 / 5", winner: "b" },
  ];

  return (
    <IllustrationTilt className="w-full max-w-[560px] mx-auto py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 blur-3xl opacity-70
          [background:radial-gradient(55%_55%_at_50%_50%,hsl(var(--magenta-1)/0.28),transparent_70%)]"
      />

      <div className="relative bg-white rounded-3xl shadow-elev-4 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[96px_1fr_1fr] text-[11px] font-semibold uppercase tracking-[0.1em]">
          <div className="px-4 py-3 bg-secondary text-muted-foreground">Metric</div>
          <div className="px-4 py-3 bg-secondary border-l border-line text-muted-foreground">
            Partner A
          </div>
          <div className="px-4 py-3 bg-magenta-1/10 border-l border-line text-magenta-1 inline-flex items-center gap-1.5">
            Partner B <span className="text-[11px]">★</span>
          </div>
        </div>

        {rows.map((r, i) => (
          <m.div
            key={r.label}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-[96px_1fr_1fr] text-[13.5px] border-t border-line"
          >
            <div className="px-4 py-3 text-muted-foreground font-medium">
              {r.label}
            </div>
            <div
              className={cn(
                "px-4 py-3 border-l border-line tabular-nums",
                r.winner === "a" ? "bg-magenta-1/10 text-magenta-1 font-semibold" : "text-foreground",
              )}
            >
              {r.a}
            </div>
            <div
              className={cn(
                "px-4 py-3 border-l border-line tabular-nums inline-flex items-center gap-1.5",
                r.winner === "b" ? "bg-magenta-1/10 text-magenta-1 font-semibold" : "text-foreground",
              )}
            >
              {r.b}
              {r.winner === "b" && <Check className="h-3.5 w-3.5" />}
            </div>
          </m.div>
        ))}

        <div className="px-4 py-3.5 border-t border-line bg-brand-gradient">
          <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.1em] text-white">
            <span>Recommended</span>
            <span className="inline-flex items-center gap-1.5">
              Select Partner B
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>

      <FloatBadge className="-top-5 right-6" depth={55}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-magenta-gradient text-white shrink-0">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="text-[12.5px] font-medium text-foreground whitespace-nowrap">
          Saved $260K
        </span>
      </FloatBadge>
    </IllustrationTilt>
  );
}

/* ──────────────────────────────────────────────────────────────────
   #4 — Audit trail: vertical timeline, bigger
   ────────────────────────────────────────────────────────────────── */
export function AuditIllu() {
  const events = [
    { t: "10:24 AM",  d: "Brief drafted",        sub: "AtlasBank · data migration", done: true },
    { t: "11:02 AM",  d: "Anonymised + matched", sub: "3 partners · EU-West",       done: true },
    { t: "Day 2",     d: "3 proposals received", sub: "Partner A, B, C responded",  done: true },
    { t: "Day 4",     d: "Procurement reviewed", sub: "Legal sign-off pending",     done: false },
  ];
  const doneCount = events.filter((e) => e.done).length;
  const total = events.length;
  const doneFrac = doneCount / total;

  return (
    <IllustrationTilt className="w-full max-w-[560px] mx-auto py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 blur-3xl opacity-70
          [background:radial-gradient(55%_55%_at_50%_50%,hsl(var(--brand-3)/0.3),transparent_70%)]"
      />

      <div className="relative bg-white rounded-3xl shadow-elev-4 p-7">
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Audit trail
            </span>
            <div className="text-[16px] font-semibold tracking-[-0.012em] text-foreground mt-0.5">
              AtlasBank · SoW #1829
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-magenta-1 px-2.5 py-1 rounded-full bg-magenta-1/10">
            <span className="h-1.5 w-1.5 rounded-full bg-magenta-1 animate-pulse-dot" />
            Live
          </span>
        </div>

        <div className="relative pl-7">
          {/* Vertical baseline */}
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-line" />
          {/* Progress fill */}
          <m.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: doneFrac }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-2.5 top-1 w-px h-full origin-top bg-magenta-1"
          />
          <div className="space-y-5">
            {events.map((e, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: 0.35 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <span
                  className={cn(
                    "absolute -left-7 top-0.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white",
                    e.done ? "bg-magenta-1" : "bg-line-strong",
                  )}
                >
                  {e.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />}
                </span>
                <div className="text-[14px] font-semibold text-foreground leading-tight">
                  {e.d}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {e.sub}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {e.t}
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </div>

      <FloatBadge className="-bottom-5 -right-4" depth={60}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-white shrink-0">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="text-[12.5px] font-medium text-foreground whitespace-nowrap">
          SOC-2 ready
        </span>
      </FloatBadge>
    </IllustrationTilt>
  );
}
