"use client";

import { useState } from "react";
import { Lightbulb, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExampleAnswer } from "@/lib/example-answers";

/**
 * Inline "Show example" disclosure surfaced underneath an assistant
 * message. Encourages high-quality responses by showing what a great
 * answer looks like — and a rubric of *why* it's great.
 */
export function ExampleAnswerCard({ example }: { example: ExampleAnswer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 max-w-[680px]">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1",
          "text-[11.5px] font-semibold text-primary hover:bg-primary/10 transition-colors",
        )}
        aria-expanded={open}
      >
        <Lightbulb className="h-3 w-3" />
        {open ? "Hide example" : "Show me a great answer"}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-160",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-3.5 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">
              <Sparkles className="h-3 w-3" />
              {example.label}
            </div>
            <p className="mt-1.5 text-[13px] text-foreground leading-relaxed">
              {example.exemplar}
            </p>
          </div>
          <div className="rounded-lg bg-card border border-primary/10 p-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
              Why this works
            </div>
            <ul className="space-y-1">
              {example.whyItsGood.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-[12px] text-foreground/80"
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
