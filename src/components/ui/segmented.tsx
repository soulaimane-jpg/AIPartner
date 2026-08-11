"use client";

import * as React from "react";
import { m, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { indicatorSpring } from "@/lib/motion";

export type SegmentedItem<V extends string = string> = {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional small count chip on the right (e.g. inbox counts). */
  count?: number;
};

export interface SegmentedProps<V extends string = string> {
  items: SegmentedItem<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: "sm" | "md";
  className?: string;
  /** Forces full-width distribution. */
  fullWidth?: boolean;
}

/**
 * Inline segmented control with a sliding pill indicator that uses Framer's
 * `layoutId` so the active background animates between items rather than
 * fading. Used for dashboard filter chips, quick toggles, etc.
 *
 * Single-source-of-truth controlled component (no internal state).
 */
export function Segmented<V extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  className,
  fullWidth,
}: SegmentedProps<V>) {
  const id = React.useId();
  const heightCls = size === "sm" ? "h-7" : "h-8";
  const padCls    = size === "sm" ? "px-2.5 text-[12px]" : "px-3 text-[13px]";

  return (
    <LayoutGroup id={`segmented-${id}`}>
      <div
        role="tablist"
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md p-0.5 bg-surface-2 border border-line",
          fullWidth && "w-full",
          className,
        )}
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "relative inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium",
                "transition-colors duration-120 ease-out-quart",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "[&_svg]:size-3.5",
                heightCls,
                padCls,
                fullWidth && "flex-1",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <m.span
                  layoutId="segmented-indicator"
                  transition={indicatorSpring}
                  className="absolute inset-0 rounded-[5px] bg-card border border-line shadow-elev-1"
                />
              )}
              <span className="relative z-[1] inline-flex items-center gap-1.5">
                {item.icon}
                {item.label}
                {typeof item.count === "number" && (
                  <span
                    className={cn(
                      "ml-1 inline-grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-foreground text-background"
                        : "bg-line text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
