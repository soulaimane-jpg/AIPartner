"use client";

import Link from "next/link";
import {
  Clock,
  FileText,
  Sparkles,
  Calendar,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  MessagesSquare,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailDrawer } from "@/components/portal/detail-drawer";
import { BriefActionsMenu } from "@/components/brief-actions-menu";
import { STAGE_LABELS, STAGE_ORDER, SERVICE_CATEGORIES_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkspaceBrief } from "./types";

/**
 * Right‑side drawer with a live summary of the selected brief. Provides
 * quick navigation into the three deep surfaces (Workspace, Preview,
 * Proposals) without forcing the user to leave the dashboard.
 */
export function BriefDrawer({
  brief,
  onOpenChange,
}: {
  brief: WorkspaceBrief | null;
  onOpenChange: (next: boolean) => void;
}) {
  const open = !!brief;
  const stageIdx = brief ? STAGE_ORDER.indexOf(brief.stage as never) : -1;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      width={540}
      title={
        brief ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{brief.title}</span>
            <BriefActionsMenu briefId={brief.id} briefTitle={brief.title} />
          </div>
        ) : (
          "Brief"
        )
      }
      subtitle={
        brief ? (
          <span className="inline-flex items-center gap-2">
            <Badge
              variant={brief.status === "DRAFT" ? "muted" : "success"}
              className="text-[10px] uppercase tracking-wider"
            >
              {brief.status}
            </Badge>
            <span>·</span>
            <span>{STAGE_LABELS[brief.stage] ?? brief.stage}</span>
          </span>
        ) : null
      }
      footer={
        brief ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/briefs/${brief.id}/preview`}>
                Preview <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/briefs/${brief.id}/builder`}>
                Open workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        ) : null
      }
    >
      {brief && (
        <div className="space-y-6">
          {brief.hasActionRequired && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/10 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 text-[12.5px] leading-relaxed text-foreground">
                <div className="font-semibold">Action required</div>
                {brief.stage === "REVIEW" && <>Approve proposed partners to unblock proposals.</>}
                {brief.stage === "SELECTION" && <>Compare proposals and select your partner.</>}
                {brief.stage === "INTAKE" && <>Finish scoping to move to sourcing.</>}
              </div>
            </div>
          )}

          {/* Completion */}
          <section>
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground mb-1.5">
              <span>Completion</span>
              <span className="tabular-nums">{brief.completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-400"
                style={{ width: `${Math.min(100, brief.completion)}%` }}
              />
            </div>
          </section>

          {/* Stage tracker */}
          <section>
            <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-3">
              Pipeline stage
            </div>
            <ol className="space-y-2">
              {STAGE_ORDER.map((s, i) => {
                const reached = i <= stageIdx;
                const active = i === stageIdx;
                return (
                  <li key={s} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        reached
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {reached ? <CheckCircle2 className="h-3 w-3" /> : <span className="text-[9px]">{i + 1}</span>}
                    </span>
                    <span
                      className={cn(
                        "text-[12.5px]",
                        active ? "text-foreground font-semibold" : reached ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {STAGE_LABELS[s] ?? s}
                    </span>
                    {active && (
                      <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                        Now
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Stats grid */}
          <section className="grid grid-cols-2 gap-3">
            <Stat
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Proposals"
              value={brief.proposalsCount.toString()}
            />
            <Stat
              icon={<Users className="h-3.5 w-3.5" />}
              label="Matches"
              value={brief.matchesCount.toString()}
            />
            <Stat
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Go‑live"
              value={brief.targetGoLive ?? "Not set"}
            />
            <Stat
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Budget"
              value={brief.budgetRange ?? "Not set"}
            />
          </section>

          {/* Services */}
          {brief.services.length > 0 && (
            <section>
              <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-2">
                Required services
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brief.services.map((s) => (
                  <Badge key={s} variant="outline" className="text-[11px]">
                    {SERVICE_CATEGORIES_LABEL[s] ?? s}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Quick actions */}
          <section className="space-y-2">
            <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Quick actions
            </div>
            <div className="space-y-2">
              <LinkTile
                href={`/briefs/${brief.id}/builder`}
                icon={<MessagesSquare className="h-4 w-4" />}
                title="AI builder"
                hint="Continue scoping with the assistant"
              />
              <LinkTile
                href={`/briefs/${brief.id}/proposals`}
                icon={<Sparkles className="h-4 w-4" />}
                title="Review proposals"
                hint={`${brief.proposalsCount} submitted`}
              />
              <LinkTile
                href={`/briefs/${brief.id}/edit`}
                icon={<FileText className="h-4 w-4" />}
                title="Edit SoW"
                hint="Manual edits"
              />
            </div>
          </section>

          {/* Meta */}
          <section className="pt-2 border-t border-border text-[11.5px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Updated {new Date(brief.updatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 opacity-60" />
              Created {new Date(brief.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </section>
        </div>
      )}
    </DetailDrawer>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunk p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold text-foreground truncate">
        {value}
      </div>
    </div>
  );
}

function LinkTile({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
        "hover:border-border-strong hover:shadow-elev-1 transition-[border-color,box-shadow]",
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{hint}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
