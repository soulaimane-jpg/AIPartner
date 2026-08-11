import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRight, FolderKanban, FileEdit, Share2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BriefActionsMenu } from "@/components/brief-actions-menu";
import { computeCompletion } from "@/lib/brief";
import { safeJsonParse, timeAgo } from "@/lib/utils";
import { SERVICE_CATEGORIES_LABEL, STAGE_LABELS } from "@/lib/constants";
import type { ServiceCategory, BriefStage, BriefStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";
export const metadata = { title: "Briefs · AI Partner" };

/**
 * Briefs index — flat list of every brief the customer owns.
 *
 * Distinct from `/dashboard` which is the "workspace" overview (greeting,
 * action card, kanban). This page is just the list, sorted by recency.
 */
export default async function BriefsIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/briefs");

  const rows = await query<ProjectBriefRow & { proposalsCount: number }>(
    `SELECT b.*,
       (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id")::int AS "proposalsCount"
     FROM "ProjectBrief" b
     WHERE b."ownerId" = $1
     ORDER BY b."updatedAt" DESC`,
    [session.user.id],
  );

  return (
    <div className="page-container portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden>
            <FolderKanban className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">Project inventory</div>
            <h1 className="portal-page-title">Briefs</h1>
            <p className="portal-page-description">
              Track scope, readiness, partner responses, and recent activity in one place.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="default" className="w-full sm:w-auto">
            <Link href="/briefs/new">
              <Plus className="h-4 w-4" />
              New brief
            </Link>
          </Button>
        </div>
      </header>

      {/* Sub-tab navigation */}
      <nav className="flex items-center gap-1 border-b border-border mb-6">
        <Link
          href="/briefs"
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            true
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileEdit className="h-3.5 w-3.5" />
          Create Briefs
        </Link>
        <Link
          href="/briefs/shared"
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
            false
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          Shared Briefs
        </Link>
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-elev-1 sm:p-14">
          <h2 className="text-[18px] font-semibold text-foreground">
            No briefs yet
          </h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground max-w-md mx-auto">
            The AI builder will help you scope a Statement of Work — one
            question at a time.
          </p>
          <div className="mt-5">
            <Button asChild>
              <Link href="/briefs/new">
                <Plus className="h-4 w-4" />
                Create your first brief
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((b) => {
              const services = safeJsonParse<ServiceCategory[]>(b.services, []);
              const completion = computeCompletion(b);
              return (
                <Link
                  key={b.id}
                  href={`/briefs/${b.id}/preview`}
                  className="group rounded-xl border border-border bg-card p-4 shadow-elev-1 transition-[border-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:border-primary/30 hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-semibold text-foreground">{b.title}</h2>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10.5px]">
                          {STAGE_LABELS[b.stage as BriefStage] ?? b.stage}
                        </Badge>
                        {(b.status as BriefStatus) === "ARCHIVED" && (
                          <Badge variant="outline" className="text-[10.5px]">Archived</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <BriefActionsMenu briefId={b.id} briefTitle={b.title} />
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-160 group-hover:translate-x-0.5" />
                    </div>
                  </div>
                  {services.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {services.slice(0, 3).map((service) => (
                        <Badge key={service} variant="outline" className="text-[10.5px]">
                          {SERVICE_CATEGORIES_LABEL[service]}
                        </Badge>
                      ))}
                      {services.length > 3 && <span className="text-[10.5px] text-muted-foreground">+{services.length - 3}</span>}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span><strong className="block text-[12px] font-semibold text-foreground">{completion}%</strong>Completion</span>
                    <span><strong className="block text-[12px] font-semibold text-foreground">{b.proposalsCount}</strong>Proposals</span>
                    <span><strong className="block text-[12px] font-semibold text-foreground">{timeAgo(b.updatedAt)}</strong>Updated</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-elev-1 md:block">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-b border-border bg-surface-sunk text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Brief</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Completion</th>
                <th className="px-4 py-3 font-medium">Proposals</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium w-20" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((b) => {
                const services = safeJsonParse<ServiceCategory[]>(b.services, []);
                const completion = computeCompletion(b);
                return (
                  <tr
                    key={b.id}
                    className="group transition-colors hover:bg-primary/5"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/briefs/${b.id}/preview`}
                        className="font-semibold text-foreground transition-colors group-hover:text-primary"
                      >
                        {b.title}
                      </Link>
                      {services.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {services.slice(0, 3).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10.5px]">
                              {SERVICE_CATEGORIES_LABEL[s]}
                            </Badge>
                          ))}
                          {services.length > 3 && (
                            <span className="text-[10.5px] text-muted-foreground">
                              +{services.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[11px]">
                        {STAGE_LABELS[b.stage as BriefStage] ?? b.stage}
                      </Badge>
                      {(b.status as BriefStatus) === "ARCHIVED" && (
                        <Badge variant="outline" className="ml-1 text-[11px]">
                          Archived
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11.5px] text-muted-foreground">
                          {completion}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.proposalsCount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {timeAgo(b.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <BriefActionsMenu briefId={b.id} briefTitle={b.title} variant="row" />
                        <Link
                          href={`/briefs/${b.id}/preview`}
                          aria-label={`Open ${b.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
