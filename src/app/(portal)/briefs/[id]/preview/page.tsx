import { notFound, redirect } from "next/navigation";
import {
  FileText,
  Layers,
  Target,
  Database,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { ProjectBriefRow, BriefCollaboratorRow } from "@/lib/db/rows";
import { BriefWorkspaceHeader } from "@/components/brief-workspace-header";
import { Pipeline } from "@/components/pipeline";
import { Badge } from "@/components/ui/badge";
import { MeetingTimePicker } from "@/components/brief/meeting-time-picker";
import { ReviewWorkflowCard } from "@/components/review-workflow-card";
import { AnonymizedSummaryPreview } from "@/components/anonymized-summary-preview";
import { CollaboratorsPanel, type CollaboratorRow } from "@/components/brief/collaborators-panel";
import { QaSectionCustomer } from "@/components/brief/qa-section-customer";
import {
  RiskRadarCard,
  type RiskRadarSnapshot,
} from "@/components/brief/risk-radar-card";
import { hashBriefForRadar } from "@/lib/risk-radar";
import { safeJsonParse } from "@/lib/utils";
import { computeCompletionBreakdown, MIN_SUBMIT_COMPLETION } from "@/lib/brief";
import { SERVICE_CATEGORIES_LABEL } from "@/lib/constants";
import type {
  BriefStage,
  BriefStatus,
  CollaboratorRole,
  ServiceCategory,
} from "@/lib/enums";
import type { CustomerAnonymizedProfile } from "@/lib/customer-profile";

export const dynamic = "force-dynamic";

export default async function BriefPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  // Brief access: owner OR same-company OR active BriefCollaborator. The
  // RBAC matrix already enforces this via `brief.read: isOwnBriefOrCollaborator`
  // for server actions — here we replicate the same check inline because we
  // need the row regardless of permission outcome.
  const brief = await queryOne<
    ProjectBriefRow & {
      companyName: string | null;
      anonymizedProfile: string | null;
      proposalsCount: number;
    }
  >(
    `SELECT b.*, c."name" AS "companyName",
            cp."anonymizedProfile",
            (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id")::int AS "proposalsCount"
     FROM "ProjectBrief" b
     LEFT JOIN "Company" c ON c."id" = b."companyId"
     LEFT JOIN "CustomerProfile" cp ON cp."companyId" = b."companyId"
     WHERE b."id" = $1`,
    [id],
  );
  if (!brief) notFound();

  // Counts only — this page never renders partner identity, and
  // selecting it would put identifying columns one JSX line away from
  // a pre-reveal leak (§8).
  const matchCounts = await queryOne<{
    total: number;
    sourced: number;
  }>(
    `SELECT COUNT(*)::int AS "total",
            COUNT(*) FILTER (WHERE "status" = 'SOURCED')::int AS "sourced"
     FROM "Match" WHERE "briefId" = $1`,
    [id],
  );
  const totalMatches = matchCounts?.total ?? 0;
  const sourcedMatches = matchCounts?.sourced ?? 0;

  const collaborators = await query<BriefCollaboratorRow>(
    `SELECT * FROM "BriefCollaborator"
     WHERE "briefId" = $1 AND "status" <> 'REMOVED'
     ORDER BY "createdAt" ASC`,
    [id],
  );

  // Latest pre-submit review, plus whether it still describes the brief as
  // it stands now. `submitBriefAction` re-derives the same hash, so a
  // report written against an older version of the brief is not a pass.
  const radarRow = await queryOne<{
    id: string;
    overall: string;
    findings: string;
    briefHash: string;
    acknowledgedAt: Date | null;
  }>(
    `SELECT "id", "overall", "findings", "briefHash", "acknowledgedAt"
       FROM "RiskRadarReport"
      WHERE "briefId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1`,
    [id],
  );
  const radarSnapshot: RiskRadarSnapshot | null = radarRow
    ? {
        id: radarRow.id,
        overall: radarRow.overall as RiskRadarSnapshot["overall"],
        findings: safeJsonParse<RiskRadarSnapshot["findings"]>(
          radarRow.findings,
          [],
        ),
        acknowledgedAt: radarRow.acknowledgedAt,
        stale: radarRow.briefHash !== hashBriefForRadar(brief),
      }
    : null;

  const userEmail = (session.user.email ?? "").toLowerCase();
  const isOwner = brief.ownerId === session.user.id;
  const isCompanyMember =
    !!session.user.companyId && brief.companyId === session.user.companyId;
  const myCollaboratorRow = collaborators.find(
    (c) => c.email.toLowerCase() === userEmail,
  );
  const isCollaborator = !!myCollaboratorRow;
  if (!isOwner && !isCompanyMember && !isCollaborator) notFound();

  // Non-owner viewers see a constrained chrome (no submit footer, no
  // partner-match actions). VIEWER stays read-only; EDITOR can
  // also edit per the RBAC matrix.
  const viewerKind: "owner" | "collaborator" =
    isOwner || isCompanyMember ? "owner" : "collaborator";
  const collabRoleLabel =
    myCollaboratorRow?.role === "EDITOR"
      ? "Editor"
      : "Viewer";

  const collaboratorRows: CollaboratorRow[] = collaborators.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    role: c.role as CollaboratorRole,
    status: c.status as CollaboratorRow["status"],
    acceptedAt: c.acceptedAt?.toISOString() ?? null,
    approvedAt: c.approvedAt?.toISOString() ?? null,
    rejectedAt: c.rejectedAt?.toISOString() ?? null,
    reviewNote: c.reviewNote,
    inviteToken: c.inviteToken,
  }));

  // Anonymized profile partners will see.
  let anonProfile: CustomerAnonymizedProfile | null = null;
  const rawAnon = brief.anonymizedProfile;
  if (rawAnon) {
    try {
      const parsed = JSON.parse(rawAnon);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        anonProfile = parsed as CustomerAnonymizedProfile;
      }
    } catch {
      anonProfile = null;
    }
  }

  const scope = safeJsonParse<{ title: string; detail: string }[]>(brief.scopeRequirements, []);
  const dataSources = safeJsonParse<{ name: string; detail: string }[]>(brief.dataSources, []);
  const integrations = safeJsonParse<{ title: string; detail: string }[]>(brief.integrationPoints, []);
  const success = safeJsonParse<{ metric: string; target: string }[]>(brief.successCriteria, []);
  const roles = safeJsonParse<{ role: string; availability: string }[]>(brief.customerRoles, []);
  const milestones = safeJsonParse<{ title: string; date: string }[]>(brief.milestones, []);
  const services = safeJsonParse<ServiceCategory[]>(brief.services, []);

  const breakdown = computeCompletionBreakdown(brief);

  const sections: Array<{ id: string; label: string; done: boolean }> = breakdown.sections.map((s) => ({
    id: s.key,
    label: s.label,
    done: s.score >= s.weight,
  }));

  return (
    <div className="page-container-wide pt-6 pb-20">
      {viewerKind === "collaborator" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-foreground">
          <div>
            <span className="font-semibold">You&apos;re collaborating as {collabRoleLabel}.</span>{" "}
            <span className="text-muted-foreground">
              You only have access to this brief. Partner matching and
              project submission are managed by the brief owner.
            </span>
          </div>
        </div>
      )}
      <BriefWorkspaceHeader
        briefId={brief.id}
        title={brief.title}
        stage={brief.stage as BriefStage}
        status={brief.status as BriefStatus}
        completion={brief.completion}
        proposalsCount={brief.proposalsCount}
        hasMatches={sourcedMatches > 0}
      />

      {/* Waiting for proposals — shown when partners have been invited */}
      {brief.stage === "PROPOSALS" && totalMatches > 0 && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-foreground">
              Waiting for proposals
            </p>
            <p className="text-[12.5px] text-primary mt-0.5">
              {totalMatches} partner{totalMatches === 1 ? "" : "s"} received your brief. You&apos;ll be notified when proposals arrive.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] mt-6">
        {/* Main canvas */}
        <div className="space-y-6 min-w-0">
          {/* Pipeline visual */}
          <section className="rounded-2xl bg-card border border-border shadow-elev-1 p-5">
            <Pipeline stage={brief.stage as never} />
          </section>

          {/* Anonymized summary */}
          <AnonymizedSummaryPreview
            anon={anonProfile}
            companyName={brief.companyName ?? undefined}
          />

          {/* Pre‑submission review workflow */}
          <div id="review-workflow">
            <ReviewWorkflowCard
              briefId={brief.id}
              initial={{
                reviewWorkflowConfirmed: brief.reviewWorkflowConfirmed,
                requiresInternalReview: brief.requiresInternalReview,
                internalReviewerName: brief.internalReviewerName,
                internalReviewerEmail: brief.internalReviewerEmail,
                internalReviewerRole: brief.internalReviewerRole,
                reviewWorkflowNotes: brief.reviewWorkflowNotes,
              }}
            />
          </div>

          {/* Project collaborators — invite reviewers / approvers */}
          <div id="collaborators">
            <CollaboratorsPanel
              briefId={brief.id}
              briefTitle={brief.title}
              collaborators={collaboratorRows}
              currentUserEmail={session.user.email ?? ""}
              isOwner={viewerKind === "owner"}
            />
          </div>

          {/* Executive summary */}
          <CanvasSection icon={<FileText className="h-4 w-4" />} title="Executive summary" id="summary">
            {brief.executiveSummary ? (
              <p className="text-[13.5px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {brief.executiveSummary}
              </p>
            ) : (
              <EmptyText>Initial discovery incomplete. Use the AI Builder to generate the summary.</EmptyText>
            )}
          </CanvasSection>

          {/* Scope & requirements */}
          <CanvasSection icon={<Layers className="h-4 w-4" />} title="Scope & requirements" id="scope">
            {scope.length === 0 ? (
              <EmptyText>No technical requirements defined yet.</EmptyText>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {scope.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="text-[10.5px] font-mono text-muted-foreground">REQ‑{String(i + 1).padStart(2, "0")}</div>
                    <div className="mt-1 text-[13.5px] font-semibold text-foreground">{s.title}</div>
                    <div className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">{s.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </CanvasSection>

          {/* Success criteria */}
          <CanvasSection icon={<Target className="h-4 w-4" />} title="Success criteria" id="success">
            {success.length === 0 ? (
              <EmptyText>Define KPIs in the AI builder.</EmptyText>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-secondary/40 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5">Metric</th>
                      <th className="text-left px-4 py-2.5">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {success.map((s, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="px-4 py-2.5 font-medium text-foreground">{s.metric}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CanvasSection>

          {/* Architecture context */}
          <CanvasSection icon={<Database className="h-4 w-4" />} title="Architecture context" id="stack">
            <div className="grid gap-4 sm:grid-cols-2">
              <SubBlock title="Current environment">
                {dataSources.length === 0 ? (
                  <EmptyText size="xs">Not provided.</EmptyText>
                ) : (
                  <ul className="space-y-2">
                    {dataSources.map((d, i) => (
                      <li key={i}>
                        <div className="text-[12.5px] font-semibold text-foreground">{d.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{d.detail}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </SubBlock>
              <SubBlock title="Integration points">
                {integrations.length === 0 ? (
                  <EmptyText size="xs">No integrations mapped.</EmptyText>
                ) : (
                  <ul className="space-y-2">
                    {integrations.map((it, i) => (
                      <li key={i}>
                        <div className="text-[12.5px] font-semibold text-foreground">{it.title}</div>
                        <div className="text-[11.5px] text-muted-foreground">{it.detail}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </SubBlock>
            </div>
          </CanvasSection>

          {/* Stakeholders */}
          {roles.length > 0 && (
            <CanvasSection icon={<Users className="h-4 w-4" />} title="Stakeholders" id="stakeholders">
              <ul className="grid gap-2 sm:grid-cols-2">
                {roles.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2"
                  >
                    <span className="text-[12.5px] font-medium text-foreground">{r.role}</span>
                    <Badge variant="muted" className="text-[10px] uppercase tracking-wider">
                      {r.availability}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CanvasSection>
          )}

          {/* Submit footer — propose alignment meeting & send to AI Partner.
              Owner-only: collaborators don't get to submit the SoW. */}
          {brief.status === "DRAFT" && viewerKind === "owner" && (() => {
            const approvers = collaboratorRows.filter((c) => c.role === "EDITOR");
            const pendingApprovers = approvers.filter((c) => !c.approvedAt && !c.rejectedAt);
            const completionOk = brief.completion >= MIN_SUBMIT_COMPLETION;
            const reviewOk = brief.reviewWorkflowConfirmed;
            const blockers: string[] = [];
            if (!completionOk) blockers.push(`Reach ${MIN_SUBMIT_COMPLETION}% completion (currently ${brief.completion}%)`);
            if (!reviewOk) blockers.push("Confirm your internal review workflow above");
            if (pendingApprovers.length > 0) {
              blockers.push(
                `Awaiting approval from ${pendingApprovers.map((c) => c.name ?? c.email).join(", ")}`,
              );
            }
            // The server gate requires a CURRENT, non-blocking radar report
            // (see `evaluateRiskRadarGate`). Mirror it here so the customer
            // sees why the button is disabled — and so the blocker is
            // actionable via the card rendered directly above.
            if (!radarSnapshot) {
              blockers.push("Run the pre-submit review (Risk Radar)");
            } else if (radarSnapshot.stale) {
              blockers.push("Re-run Risk Radar — the brief changed since the last scan");
            } else if (
              (radarSnapshot.overall === "block" ||
                radarSnapshot.overall === "failed") &&
              !radarSnapshot.acknowledgedAt
            ) {
              blockers.push(
                radarSnapshot.overall === "failed"
                  ? "Risk Radar didn't complete — re-run or acknowledge it"
                  : "Address or acknowledge the Risk Radar blockers",
              );
            }
            const disabled = blockers.length > 0;
            return (
              <section
                id="submit"
                className="rounded-2xl bg-card border border-border shadow-elev-1 p-5 space-y-4"
              >
                {/* Pre-submit review. Without this mounted, the server's
                    fail-closed radar gate would be unsatisfiable. */}
                <RiskRadarCard briefId={brief.id} initial={radarSnapshot} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-foreground/70" />
                      <h3 className="text-[13.5px] font-medium">Ready to send to AI Partner?</h3>
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      Optionally propose 1-3 times for an alignment call, or just submit and we&apos;ll start sourcing right away.
                    </p>
                    {blockers.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {blockers.map((b) => (
                          <li
                            key={b}
                            className="inline-flex items-center gap-1.5 text-[11.5px] text-amber-700"
                          >
                            <AlertTriangle className="h-3 w-3" /> {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <MeetingTimePicker
                    briefId={brief.id}
                    disabled={disabled}
                    disabledReason={blockers[0]}
                  />
                </div>
              </section>
            );
          })()}

          {/* Partner Q&A — anonymous questions routed to the brief owner */}
          <QaSectionCustomer briefId={brief.id} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-[280px] lg:self-start">
          {/* Completion checklist */}
          <div className="rounded-2xl bg-card border border-border shadow-elev-1 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11.5px] font-medium text-muted-foreground">
                Completion
              </div>
              <span className="text-[12px] font-medium text-foreground/85 tabular-nums">
                {brief.completion}%
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-300"
                style={{ width: `${brief.completion}%` }}
              />
            </div>
            <ul className="mt-4 space-y-1.5">
              {sections.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    aria-hidden
                    className={
                      s.done
                        ? "grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-background"
                        : "h-3.5 w-3.5 rounded-full border border-border"
                    }
                  >
                    {s.done ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                  </span>
                  <a
                    href={`#${s.id}`}
                    className={
                      s.done
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline & budget */}
          <div className="rounded-2xl bg-card border border-border shadow-elev-1 p-4 space-y-3">
            <div className="text-[11.5px] font-medium text-muted-foreground">
              Timeline & budget
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Go‑live
              </span>
              <span className="font-mono text-foreground">{brief.targetGoLive ?? "TBD"}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                Budget
              </span>
              <span className="font-mono text-foreground">{brief.budgetRange ?? "TBD"}</span>
            </div>

            {milestones.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                  Milestones
                </div>
                <ul className="space-y-1.5">
                  {milestones.map((m, i) => (
                    <li key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-foreground">{m.title}</span>
                      <span className="font-mono text-muted-foreground">{m.date}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Required services */}
          <div className="rounded-2xl bg-card border border-border shadow-elev-1 p-4">
            <div className="text-[11.5px] font-medium text-muted-foreground mb-2">
              Required services
            </div>
            {services.length === 0 ? (
              <EmptyText size="xs">None set.</EmptyText>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <Badge key={s} variant="outline" className="text-[11px]">
                    {SERVICE_CATEGORIES_LABEL[s] ?? s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
}

function CanvasSection({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl bg-card border border-border shadow-elev-1 p-5 scroll-mt-[160px]"
    >
      <header className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground/85">{icon}</span>
        <h2 className="text-[13.5px] font-medium tracking-tight text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyText({
  children,
  size = "sm",
}: {
  children: React.ReactNode;
  size?: "xs" | "sm";
}) {
  return (
    <p
      className={
        size === "xs"
          ? "text-[12px] text-muted-foreground italic"
          : "text-[13px] text-muted-foreground italic"
      }
    >
      {children}
    </p>
  );
}
