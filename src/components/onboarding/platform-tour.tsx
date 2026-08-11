"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  X,
  LayoutGrid,
  FolderKanban,
  BookOpen,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aip-platform-tour-seen-v1";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  hint?: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to AI Partner",
    body: "Quick 60-second tour so you know what's where. You can skip any time.",
  },
  {
    icon: LayoutGrid,
    title: "Workspace",
    body: "Your home page. See every brief, what's waiting on you, and what's in flight — all at a glance.",
    hint: "Look at the left rail — that's your nav.",
  },
  {
    icon: FolderKanban,
    title: "Briefs",
    body: "Every project you've scoped. Click one to open the AI Builder, edit it manually, or compare proposals from partners.",
  },
  {
    icon: BookOpen,
    title: "Templates",
    body: "Reference content for every engagement type. Shows you what info to provide, what good answers look like, and why each piece matters when partners price the work.",
  },
  {
    icon: CheckCircle2,
    title: "Ready to start",
    body: "Click 'New brief' anywhere to scope your first project. The AI Builder will guide you question-by-question.",
    hint: "You can re-open this tour anytime from Settings.",
  },
];

/**
 * First-time platform tour. Renders a centred modal carousel the first
 * time a user lands on the dashboard. Persists a flag in localStorage so
 * it shows exactly once. Respects ESC + clicking the backdrop.
 */
export function PlatformTour({ autoOpen = true }: { autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // Decide whether to open on mount (client-only, after hydration).
  useEffect(() => {
    if (!autoOpen) return;
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage may be disabled (private mode); just skip.
    }
  }, [autoOpen]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = (markSeen: boolean) => {
    if (markSeen) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* noop */
      }
    }
    setOpen(false);
    setIdx(0);
  };

  if (!open) return null;

  const step = STEPS[idx];
  const Icon = step.icon;
  const isLast = idx === STEPS.length - 1;
  const isFirst = idx === 0;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-tour-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close tour"
        onClick={() => finish(true)}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] cursor-default"
      />

      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-md rounded-lg border border-border bg-card",
          "shadow-[var(--elev-3,0_24px_48px_-12px_rgba(0,0,0,0.18))]",
          "p-6",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => finish(true)}
          className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= idx ? "bg-foreground" : "bg-border",
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex items-start gap-3 mb-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              Step {idx + 1} of {STEPS.length}
            </div>
            <h2
              id="platform-tour-title"
              className="text-[16px] font-semibold tracking-[-0.01em] text-foreground mt-0.5"
            >
              {step.title}
            </h2>
          </div>
        </div>

        <p className="text-[13.5px] text-foreground/80 leading-relaxed mt-3">
          {step.body}
        </p>
        {step.hint && (
          <p className="text-[12px] text-muted-foreground italic mt-2">
            {step.hint}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                size="sm"
                onClick={() => {
                  finish(true);
                  router.push("/briefs/new");
                }}
              >
                Create brief
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
