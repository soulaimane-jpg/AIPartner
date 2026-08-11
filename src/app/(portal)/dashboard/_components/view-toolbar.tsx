"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutGrid, List, Calendar, Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceView } from "./types";

const VIEW_TABS: { id: WorkspaceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "board",    label: "Board",    icon: LayoutGrid },
  { id: "list",     label: "List",     icon: List },
  { id: "calendar", label: "Calendar", icon: Calendar },
];

/**
 * Toolbar that controls the workspace view (Board / List / Calendar) and
 * provides debounced search + a stage filter dropdown. All state is
 * mirrored to the URL so it survives reloads and navigation.
 */
export function ViewToolbar({
  view,
  count,
}: {
  view: WorkspaceView;
  count: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  // Push debounced search to URL.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      const query = params.toString();
      router.replace(query ? `/dashboard?${query}` : "/dashboard");
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setView(next: WorkspaceView) {
    const params = new URLSearchParams(sp.toString());
    if (next === "board") params.delete("view");
    else params.set("view", next);
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  function setStage(next: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("stage", next);
    else params.delete("stage");
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  const stage = sp.get("stage");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: view switcher + count */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="inline-flex items-center bg-secondary/40 rounded-lg p-0.5 border border-border">
          {VIEW_TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-[12.5px] font-medium",
                  "transition-[background-color,color,box-shadow] duration-180 ease-out-quart",
                  active
                    ? "bg-card text-foreground shadow-elev-1"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={active}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <span className="text-[12.5px] text-muted-foreground">
          {count} {count === 1 ? "brief" : "briefs"}
        </span>
      </div>

      {/* Right: search + stage filter */}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search briefs"
            className={cn(
              "h-9 w-full pl-8 pr-7 rounded-lg sm:w-[260px]",
              "bg-card border border-border text-[12.5px] text-foreground",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-border-strong",
              "transition-[border-color,box-shadow] duration-180 ease-out-quart",
            )}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <StageFilterMenu value={stage} onChange={setStage} />
      </div>
    </div>
  );
}

const STAGES = [
  { id: null, label: "All stages" },
  { id: "INTAKE", label: "Scope" },
  { id: "SOURCING", label: "Sourcing" },
  { id: "REVIEW", label: "Review" },
  { id: "PROPOSALS", label: "Proposals" },
  { id: "SELECTION", label: "Selection" },
  { id: "INTRODUCTION", label: "Kickoff" },
];

function StageFilterMenu({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = STAGES.find((s) => s.id === value) ?? STAGES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-stage-menu]")) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" data-stage-menu>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg",
          "bg-card border border-border text-[12.5px] font-medium text-foreground",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          value && "border-[hsl(var(--magenta-2)/0.4)] text-[hsl(var(--magenta-2))]",
        )}
      >
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-card shadow-elev-3 p-1">
          {STAGES.map((s) => (
            <button
              key={s.id ?? "all"}
              type="button"
              role="menuitemradio"
              aria-checked={value === s.id}
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] text-foreground",
                "hover:bg-secondary",
                value === s.id && "bg-[hsl(var(--magenta-1)/0.1)] text-[hsl(var(--magenta-2))] font-medium",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
