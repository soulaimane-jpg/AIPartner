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
          "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1",
          "text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors",
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
        <div className="mt-2 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3.5 space-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-900/80">
              <Sparkles className="h-3 w-3" />
              {example.label}
            </div>
            <p className="mt-1.5 text-[13px] text-slate-800 leading-relaxed">
              {example.exemplar}
            </p>
          </div>
          <div className="rounded-lg bg-card border border-amber-100 p-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
              Why this works
            </div>
            <ul className="space-y-1">
              {example.whyItsGood.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-[12px] text-slate-700"
                >
                  <span className="text-amber-500 mt-0.5">•</span>
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
