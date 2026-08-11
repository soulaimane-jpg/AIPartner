"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   Eyebrow — tiny mono uppercase label above a heading.
   ───────────────────────────────────────────────────────────── */
export function Eyebrow({
  children,
  className,
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-2",
        tone === "accent" && "text-[hsl(var(--accent-ink))]",
        className,
      )}
    >
      {tone === "accent" && (
        <span className="inline-block h-[6px] w-[6px] rounded-full bg-[hsl(var(--accent-1))]" />
      )}
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Kicker — Fraunces italic sub-label, sits below a big display
   line or next to an eyebrow.
   ───────────────────────────────────────────────────────────── */
export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("kicker text-[14px]", className)}>{children}</span>
  );
}

/* ─────────────────────────────────────────────────────────────
   PageHeader — editorial page header with eyebrow, display
   title, optional kicker and right-aligned action slot.
   ───────────────────────────────────────────────────────────── */
export function PageHeader({
  eyebrow,
  title,
  kicker,
  description,
  actions,
  className,
  size = "md",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  kicker?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const titleSize =
    size === "lg"
      ? "text-[44px] md:text-[52px] leading-[1.04]"
      : size === "sm"
        ? "text-[24px] md:text-[28px] leading-[1.12]"
        : "text-[32px] md:text-[38px] leading-[1.08]";

  return (
    <header
      className={cn(
        "flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="max-w-3xl space-y-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1
          className={cn(
            "font-display font-medium tracking-[-0.022em] text-foreground text-balance",
            titleSize,
          )}
        >
          {title}
        </h1>
        {kicker && <div className="-mt-1"><Kicker>{kicker}</Kicker></div>}
        {description && (
          <p className="text-[14.5px] text-muted-foreground leading-[1.6] max-w-2xl text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   SectionDivider — hairline + optional eyebrow centered.
   ───────────────────────────────────────────────────────────── */
export function SectionDivider({
  label,
  className,
}: {
  label?: React.ReactNode;
  className?: string;
}) {
  if (!label) {
    return <div className={cn("hairline my-10", className)} role="separator" />;
  }
  return (
    <div
      className={cn("flex items-center gap-4 my-10", className)}
      role="separator"
    >
      <div className="hairline flex-1" />
      <span className="eyebrow shrink-0">{label}</span>
      <div className="hairline flex-1" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Stat — editorial KPI tile. Mono numerics, eyebrow label,
   optional delta + hint. Animated number reveal on mount.
   ───────────────────────────────────────────────────────────── */
export function Stat({
  label,
  value,
  hint,
  delta,
  deltaTone = "neutral",
  icon,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "neutral" | "positive" | "negative";
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-flat p-5 flex flex-col gap-3 relative overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>{label}</Eyebrow>
        {icon && (
          <span className="text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <m.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="font-mono num text-[32px] leading-none font-medium text-foreground tracking-[-0.02em]"
        >
          {value}
        </m.span>
        {delta && (
          <span
            className={cn(
              "font-mono num text-[11.5px]",
              deltaTone === "positive" && "text-[hsl(var(--success))]",
              deltaTone === "negative" && "text-[hsl(var(--danger))]",
              deltaTone === "neutral" && "text-muted-foreground",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {hint && (
        <p className="text-[12.5px] text-muted-foreground leading-[1.5]">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Stepper — numbered step list (1/3 2/3 3/3), used in
   onboarding and source-5 wizard.
   ───────────────────────────────────────────────────────────── */
export function Stepper({
  current,
  steps,
  className,
}: {
  current: number; // 0-indexed
  steps: { label: string; hint?: string }[];
  className?: string;
}) {
  return (
    <ol
      className={cn("flex items-center gap-2 flex-wrap", className)}
      aria-label="Progress"
    >
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 border transition-colors",
                active &&
                  "border-[hsl(var(--accent-1)/0.4)] bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent-ink))]",
                done &&
                  "border-border bg-card text-muted-foreground",
                !active && !done && "border-border bg-transparent text-muted-foreground",
              )}
            >
              <span className="font-mono num text-[11px]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[12.5px] font-medium">
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-6",
                  done
                    ? "bg-[hsl(var(--accent-1)/0.4)]"
                    : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────────────────────────────────────────
   InspectorPanel — right-docked drawer used for brief detail,
   partner quick-view, match detail. Slides in from the right.
   Accepts `open` + `onClose` + children.
   ───────────────────────────────────────────────────────────── */
export function InspectorPanel({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            className="fixed inset-0 z-40 bg-[hsl(var(--foreground)/0.25)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <m.aside
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 bottom-0 z-50 bg-card border-l border-border shadow-[var(--elev-3)] flex flex-col"
            style={{ width }}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="px-6 py-4 border-b border-border space-y-1">
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              {title && (
                <div className="font-display text-[20px] leading-tight font-medium text-foreground">
                  {title}
                </div>
              )}
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────
   SplitPane — left/right editorial split with a resizer feel.
   Simple static version for the brief-builder + admin detail.
   ───────────────────────────────────────────────────────────── */
export function SplitPane({
  left,
  right,
  leftMax = 680,
  rightWidth = 360,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  leftMax?: number;
  rightWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-8 lg:gap-10 items-start", className)}>
      <div className="flex-1 min-w-0" style={{ maxWidth: leftMax }}>
        {left}
      </div>
      <aside
        className="hidden lg:block sticky top-[calc(var(--topbar-h)+1rem)] shrink-0"
        style={{ width: rightWidth }}
      >
        {right}
      </aside>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Toolbar — thin utility bar with left / center / right slots,
   used at the top of index screens for filters + view switch.
   ───────────────────────────────────────────────────────────── */
export function Toolbar({
  left,
  center,
  right,
  className,
}: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-3 px-4 rounded-full bg-surface-2 border border-border",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      {center && (
        <div className="hidden md:flex items-center gap-2">{center}</div>
      )}
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MiniLegend — small label used under charts / cards.
   ───────────────────────────────────────────────────────────── */
export function MiniLegend({
  items,
  className,
}: {
  items: { label: string; swatch?: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex items-center gap-4 flex-wrap", className)}>
      {items.map((it) => (
        <li
          key={it.label}
          className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: it.swatch ?? "hsl(var(--accent-1))" }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
