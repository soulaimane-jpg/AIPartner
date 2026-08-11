"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Download,
  Send,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BriefStage, BriefStatus } from "@/lib/enums";
import { PortalBreadcrumbs } from "@/components/portal/portal-breadcrumb-context";

export type BriefHeaderStage = BriefStage;

/**
 * Sticky workspace header used by every brief sub-page (Preview /
 * Builder / Edit / Proposals).
 *
 * Calm: plain underline tabs, no colored CTAs, monochrome progress.
 */
export function BriefWorkspaceHeader({
  briefId,
  title,
  stage,
  status,
  completion,
  proposalsCount,
  hasMatches,
  primaryAction,
}: {
  briefId: string;
  title: string;
  stage: BriefHeaderStage;
  status: BriefStatus;
  completion: number;
  proposalsCount: number;
  hasMatches: boolean;
  primaryAction?: React.ReactNode;
}) {
  const pathname = usePathname();
  const tab = pathname?.split("/").pop() ?? "preview";

  const tabs: Array<{ id: string; label: string; href: string; show: boolean; badge?: string }> = [
    {
      id: "preview",
      label: "Overview",
      href: `/briefs/${briefId}/preview`,
      show: true,
    },
    {
      id: "builder",
      label: "AI Builder",
      href: `/briefs/${briefId}/builder`,
      show:
        status === "DRAFT" ||
        stage === "INTAKE" ||
        stage === "SOURCING" ||
        stage === "REVIEW",
    },
    {
      id: "edit",
      label: "Manual edit",
      href: `/briefs/${briefId}/edit`,
      show: true,
    },
    {
      id: "proposals",
      label: "Proposals",
      href: `/briefs/${briefId}/proposals`,
      show:
        proposalsCount > 0 ||
        stage === "PROPOSALS" ||
        stage === "SELECTION" ||
        stage === "INTRODUCTION",
      badge: proposalsCount > 0 ? String(proposalsCount) : undefined,
    },
  ];

  const action =
    primaryAction ??
    defaultPrimaryAction({
      briefId,
      stage,
      status,
      completion,
      hasMatches,
      proposalsCount,
    });

  const activeLabel = tabs.find((item) => item.id === tab)?.label ?? "Overview";

  return (
    <>
      <PortalBreadcrumbs
        crumbs={[
          { label: "Briefs", href: "/briefs" },
          { label: title, href: `/briefs/${briefId}/preview` },
          { label: activeLabel },
        ]}
      />
      <section className="relative z-20 pt-4 lg:sticky lg:top-14">
        <div className="overflow-hidden rounded-2xl border border-border bg-card/95 shadow-elev-2 backdrop-blur-xl">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] font-semibold tracking-[-0.015em] text-foreground">
                {title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary ring-1 ring-primary/15">
                  {STAGE_LABELS[stage] ?? stage}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 font-medium capitalize text-foreground/75">
                  {status.toLowerCase()}
                </span>
                <span className="inline-flex min-w-[170px] items-center gap-2 rounded-full bg-secondary/70 px-2.5 py-1 tabular-nums">
                  <span>{completion}% complete</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-card" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${Math.min(100, completion)}%` }}
                    />
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <a href={`/api/briefs/${briefId}/pdf`} target="_blank" rel="noopener">
                  <Download className="h-3.5 w-3.5" /> Export PDF
                </a>
              </Button>
              {action}
            </div>
          </div>

          <nav aria-label="Brief workspace" className="flex gap-1 overflow-x-auto border-t border-border px-2 sm:px-3">
            {tabs
              .filter((item) => item.show)
              .map((item) => {
                const active = tab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {item.label}
                    {item.badge && (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
          </nav>
        </div>
      </section>
    </>
  );
}

function defaultPrimaryAction({
  briefId,
  stage,
  status,
  completion,
  hasMatches,
  proposalsCount,
}: {
  briefId: string;
  stage: BriefStage;
  status: BriefStatus;
  completion: number;
  hasMatches: boolean;
  proposalsCount: number;
}) {
  // DRAFT + INTAKE → submit brief (gated by completion ≥ 40)
  if (status === "DRAFT" && stage === "INTAKE") {
    return (
      <Button asChild size="sm" disabled={completion < 40}>
        <Link href={`/briefs/${briefId}/preview#review-workflow`}>
          <Send className="h-3.5 w-3.5" /> Submit brief
        </Link>
      </Button>
    );
  }

  // REVIEW with matches → approve partners
  if (stage === "REVIEW" && hasMatches) {
    return (
      <Button asChild size="sm">
        <Link href={`/briefs/${briefId}/preview#matches`}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Pending Delivery
        </Link>
      </Button>
    );
  }

  // SELECTION with proposals → pick winner
  if (stage === "SELECTION" && proposalsCount > 0) {
    return (
      <Button asChild size="sm">
        <Link href={`/briefs/${briefId}/proposals`}>
          Pick winner <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }

  // PROPOSALS — prompt to compare
  if (stage === "PROPOSALS" && proposalsCount > 0) {
    return (
      <Button asChild size="sm">
        <Link href={`/briefs/${briefId}/proposals`}>
          Compare proposals <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }

  // INTRODUCTION — kickoff
  if (stage === "INTRODUCTION") {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" /> Kickoff in progress
      </span>
    );
  }

  // Otherwise jump to AI builder
  return (
    <Button asChild size="sm">
      <Link href={`/briefs/${briefId}/builder`}>
        Continue scoping <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}
