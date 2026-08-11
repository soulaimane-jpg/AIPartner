"use client";

import * as React from "react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/editorial";

/**
 * Spotlight — coach-mark overlay anchored to a real DOM node.
 *
 * Renders a full-screen dimmed backdrop with a transparent hole cut over
 * the target element, plus a tooltip-like caption beside the cutout.
 *
 * Target elements are referenced by a CSS selector (e.g. a `data-tour`
 * attribute). If the selector misses, the step simply falls back to a
 * centered modal with the same caption.
 */
export function Spotlight({
  open,
  step,
  total,
  selector,
  title,
  body,
  primaryLabel = "Next",
  secondaryLabel = "Skip tour",
  onPrimary,
  onSecondary,
  side = "bottom",
}: {
  open: boolean;
  step: number; // 0-indexed
  total: number;
  selector?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (!open || !selector) {
      setRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, selector, step]);

  // Caption position
  const pad = 16;
  const caption = rect
    ? {
        top:
          side === "bottom"
            ? rect.bottom + pad
            : side === "top"
              ? Math.max(16, rect.top - 200 - pad)
              : rect.top,
        left:
          side === "right"
            ? rect.right + pad
            : side === "left"
              ? Math.max(16, rect.left - 320 - pad)
              : Math.max(16, rect.left),
      }
    : null;

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dimmer with cut-out. Uses an SVG mask for a precise hole. */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                {rect && (
                  <rect
                    x={rect.left - 8}
                    y={rect.top - 8}
                    width={rect.width + 16}
                    height={rect.height + 16}
                    rx="14"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="hsl(225 25% 10%)"
              opacity="0.55"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Target outline ring */}
          {rect && (
            <m.div
              className="absolute pointer-events-none rounded-[14px] border-2"
              style={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
                borderColor: "hsl(var(--accent-1))",
                boxShadow:
                  "0 0 0 4px hsl(var(--accent-1) / 0.18), 0 0 40px hsl(var(--accent-1) / 0.3)",
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          )}

          {/* Caption */}
          <m.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "absolute w-[min(380px,calc(100vw-32px))] card-raised p-5 bg-card",
            )}
            style={
              caption
                ? { top: caption.top, left: caption.left }
                : {
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }
            }
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          >
            <div className="flex items-center justify-between mb-3">
              <Eyebrow tone="accent">
                Step <span className="font-mono num">{step + 1}</span> /{" "}
                <span className="font-mono num">{total}</span>
              </Eyebrow>
              {onSecondary && (
                <button
                  onClick={onSecondary}
                  className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {secondaryLabel}
                </button>
              )}
            </div>
            <div className="font-display text-[19px] font-medium leading-tight mb-2">
              {title}
            </div>
            <div className="text-[13.5px] text-muted-foreground leading-[1.55] mb-4">
              {body}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 rounded-full transition-all",
                      i === step
                        ? "w-5 bg-[hsl(var(--accent-1))]"
                        : "w-1 bg-border",
                    )}
                  />
                ))}
              </div>
              <Button size="sm" onClick={onPrimary}>
                {primaryLabel}
              </Button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
