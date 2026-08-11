"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A small "?" icon that reveals explanatory copy on hover or focus.
 * Use anywhere a term might be unclear to customers or partners.
 *
 * <HelpTip>Explain what this field means.</HelpTip>
 */
export function HelpTip({
  children,
  className,
  side = "top",
  align = "center",
}: {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What does this mean?"
            className={cn(
              "inline-grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-slate-500 border border-slate-200/80 shadow-sm",
              "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 focus:bg-blue-50 focus:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
              "transition-all duration-150 align-middle shrink-0",
              className,
            )}
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
