"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HeroStrip } from "./hero-strip";
import { ViewToolbar } from "./view-toolbar";
import { BoardView } from "./board-view";
import { ListView } from "./list-view";
import { CalendarView } from "./calendar-view";
import { BriefDrawer } from "./brief-drawer";
import { AnalyticsOverview } from "./analytics-overview";
import { ActionCenter } from "./action-center";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlatformTour } from "@/components/onboarding/platform-tour";
import type { CustomerDashboardAnalytics } from "@/lib/customer-dashboard";
import type { UpcomingMeeting, WorkspaceBrief, WorkspaceView } from "./types";

/**
 * Client coordinator for the customer workspace. Holds:
 *
 *   • The selected brief (drawer state)
 *   • Derived filters from URL (`view`, `q`, `stage`, `filter`)
 *   • The filtered brief list that feeds the active view
 */
export function WorkspaceClient({
  briefs,
  analytics,
  upcomingMeetings,
  greeting,
}: {
  briefs: WorkspaceBrief[];
  analytics: CustomerDashboardAnalytics;
  upcomingMeetings: UpcomingMeeting[];
  greeting: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const requestedView = sp.get("view");
  const view: WorkspaceView =
    requestedView === "list" || requestedView === "calendar" ? requestedView : "board";
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const stage = sp.get("stage");
  const filter = sp.get("filter");

  const [selected, setSelected] = useState<WorkspaceBrief | null>(null);

  const filtered = useMemo(() => {
    return briefs.filter((b) => {
      if (stage && b.stage !== stage) return false;
      if (filter === "active" && b.status === "ARCHIVED") return false;
      if (filter === "readiness" && b.completion >= 100) return false;
      if (filter === "proposals" && b.proposalsCount === 0) return false;
      if (filter === "decisions" && !b.hasActionRequired) return false;
      if (q) {
        const haystack = (
          b.title +
          " " +
          b.services.join(" ") +
          " " +
          (b.budgetRange ?? "")
        ).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [briefs, stage, filter, q]);

  const openBrief = useCallback((b: WorkspaceBrief) => setSelected(b), []);

  return (
    <div className="page-container-wide portal-page px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <HeroStrip kpis={analytics.kpis} greeting={greeting} />
      <AnalyticsOverview activity={analytics.activity} stages={analytics.stageDistribution} />
      <ActionCenter briefs={briefs} meetings={upcomingMeetings} />

      {/* Active filter chips (filter/stage/q) */}
      <ActiveChips
        filter={filter}
        stage={stage}
        q={q}
        onClear={(k) => {
          const params = new URLSearchParams(sp.toString());
          if (k === "all") {
            params.delete("filter");
            params.delete("stage");
            params.delete("q");
          } else params.delete(k);
          const query = params.toString();
          router.replace(query ? `/dashboard?${query}` : "/dashboard");
        }}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">Project workspace</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Move between portfolio, list, and delivery-date views without losing your filters.</p>
        </div>
        <ViewToolbar view={view} count={filtered.length} />

        {/* Empty */}
        {filtered.length === 0 ? (
          <EmptyState hasBriefs={briefs.length > 0} />
        ) : view === "board" ? (
          <BoardView briefs={filtered} onSelect={openBrief} />
        ) : view === "list" ? (
          <ListView briefs={filtered} onSelect={openBrief} />
        ) : (
          <CalendarView briefs={filtered} onSelect={openBrief} />
        )}
      </section>

      <BriefDrawer
        brief={selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />

      {/* First-time platform tour. Auto-opens on first visit; persists a
          localStorage flag so it shows once per browser. */}
      <PlatformTour />
    </div>
  );
}

function ActiveChips({
  filter,
  stage,
  q,
  onClear,
}: {
  filter: string | null;
  stage: string | null;
  q: string;
  onClear: (key: "filter" | "stage" | "q" | "all") => void;
}) {
  const items: Array<{ key: "filter" | "stage" | "q"; label: string }> = [];
  if (filter) items.push({ key: "filter", label: filterLabel(filter) });
  if (stage) items.push({ key: "stage", label: `Stage · ${stage}` });
  if (q) items.push({ key: "q", label: `“${q}”` });

  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          onClick={() => onClear(i.key)}
          className={cn(
            "inline-flex items-center gap-1.5 h-6 px-2 rounded-md",
            "bg-secondary/60 text-foreground border border-border",
            "text-[11.5px] hover:bg-secondary transition-colors duration-120",
          )}
        >
          {i.label}
          <span aria-hidden className="text-[11px] text-muted-foreground">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onClear("all")}
        className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors duration-120"
      >
        Clear all
      </button>
    </div>
  );
}

function filterLabel(k: string) {
  if (k === "active") return "Active only";
  if (k === "readiness") return "Needs scoping";
  if (k === "proposals") return "With proposals";
  if (k === "decisions") return "Needs decision";
  return k;
}

function EmptyState({ hasBriefs }: { hasBriefs: boolean }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border p-14 text-center">
      <div className="eyebrow mb-3">
        {hasBriefs ? "Filtered to nothing" : "Start here"}
      </div>
      <div className="font-display text-[22px] leading-[1.2] font-medium text-foreground max-w-md mx-auto mb-2 text-balance">
        {hasBriefs
          ? "Nothing matches your current filters."
          : "Describe your first cloud project."}
      </div>
      <p className="text-[13.5px] text-muted-foreground max-w-md mx-auto leading-[1.6] mb-5">
        {hasBriefs
          ? "Clear the filters, change the stage, or broaden your search."
          : "The AI builder will help you scope a Statement of Work — one question at a time."}
      </p>
      {hasBriefs ? (
        <Button asChild variant="outline" size="md">
          <Link href="/dashboard">Clear filters</Link>
        </Button>
      ) : (
        <Button asChild size="md">
          <Link href="/briefs/new">
            Create brief
          </Link>
        </Button>
      )}
    </div>
  );
}
