"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { m, useReducedMotion } from "framer-motion";
import { FolderOpen, FileStack, Sparkles, Plus, CalendarClock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerScheduleMeetingDialog } from "@/components/customer/schedule-meeting-dialog";
import { useState } from "react";

/**
 * Hero strip rendered at the top of the customer workspace. Each tile
 * is a clickable filter that updates the workspace search params.
 */
export function HeroStrip({
  kpis,
  greeting,
}: {
  kpis: {
    activeBriefs: number;
    averageReadiness: number;
    proposalsReceived: number;
    decisionsDue: number;
  };
  greeting: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const reduceMotion = useReducedMotion();
  const activeFilter = sp.get("filter") ?? "all";
  const [meetingOpen, setMeetingOpen] = useState(false);

  function setFilter(filter: string) {
    const params = new URLSearchParams(sp.toString());
    if (filter === "all") params.delete("filter");
    else params.set("filter", filter);
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <section className="space-y-5">
      <m.header
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-semibold tracking-[-0.018em] text-foreground">
            {greeting}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Scope cloud work, move decisions forward, and track every partner engagement.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full shrink-0 sm:w-auto">
          <Button asChild size="default" className="flex-1 sm:flex-none">
            <Link href="/briefs/new">
              <Plus className="h-4 w-4" />
              New brief
            </Link>
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
            onClick={() => setMeetingOpen(true)}
            className="flex-1 sm:flex-none"
          >
            <CalendarClock className="h-4 w-4" />
            Schedule a meeting
          </Button>
        </div>
      </m.header>

      <CustomerScheduleMeetingDialog open={meetingOpen} onOpenChange={setMeetingOpen} />

      <m.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="customer-kpi-grid"
      >
        <Tile
          tone="muted"
          label="Active briefs"
          value={kpis.activeBriefs}
          icon={<FolderOpen className="h-4 w-4" />}
          active={activeFilter === "active"}
          reduceMotion={reduceMotion}
          onClick={() => setFilter(activeFilter === "active" ? "all" : "active")}
        />
        <Tile
          tone="primary"
          label="Average readiness"
          value={kpis.averageReadiness}
          suffix="%"
          icon={<Gauge className="h-4 w-4" />}
          active={activeFilter === "readiness"}
          reduceMotion={reduceMotion}
          onClick={() => setFilter(activeFilter === "readiness" ? "all" : "readiness")}
        />
        <Tile
          tone="muted"
          label="Proposals received"
          value={kpis.proposalsReceived}
          icon={<FileStack className="h-4 w-4" />}
          active={activeFilter === "proposals"}
          reduceMotion={reduceMotion}
          onClick={() => setFilter(activeFilter === "proposals" ? "all" : "proposals")}
        />
        <Tile
          tone="primary"
          label="Decisions due"
          value={kpis.decisionsDue}
          icon={<Sparkles className="h-4 w-4" />}
          active={activeFilter === "decisions"}
          reduceMotion={reduceMotion}
          onClick={() => setFilter(activeFilter === "decisions" ? "all" : "decisions")}
          emphasize={kpis.decisionsDue > 0}
        />
      </m.div>
    </section>
  );
}

function Tile({
  tone,
  label,
  value,
  suffix,
  icon,
  active,
  onClick,
  emphasize,
  reduceMotion,
}: {
  tone: "muted" | "primary";
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  emphasize?: boolean;
  reduceMotion: boolean | null;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={onClick ? active : undefined}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={reduceMotion || !onClick ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left sm:p-5",
        "shadow-elev-1 transition-[box-shadow,border-color] duration-180",
        onClick && "hover:border-primary/20 hover:shadow-elev-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <span className="sr-only">{active ? "Filter active. " : ""}</span>
      {/* Cyan accent strip when emphasised */}
      {emphasize && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-primary"
        />
      )}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            tone === "primary" || emphasize
              ? "bg-primary/10 text-primary ring-1 ring-primary/15"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] text-muted-foreground">{label}</div>
          <div
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              emphasize ? "text-primary" : "text-foreground",
            )}
          >
            {value}{suffix}
          </div>
        </div>
        <span
          aria-hidden
          className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/60 group-hover:text-foreground transition-colors"
        >
          {onClick ? (active ? "filter on" : "filter") : "portfolio"}
        </span>
      </div>
    </m.button>
  );
}
