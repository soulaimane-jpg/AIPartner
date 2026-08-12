import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type {
  MatchRow,
  ProjectBriefRow,
  ProposalRow,
  ProposalSectionRow,
  CompanyRow,
  PartnerProfileRow,
} from "@/lib/db/rows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StructuredProposalBuilder } from "@/components/partner/structured-proposal-builder";
import type { PricingModel } from "@/lib/sections";
import { safeJsonParse } from "@/lib/utils";
import { SERVICE_CATEGORIES_LABEL } from "@/lib/constants";
import type { ServiceCategory } from "@/lib/enums";
import {
  getPartnerStatusLabel,
  getPartnerWorkspaceBucket,
} from "@/lib/partner-workflow";
import { MatchScoreWidget } from "@/components/partner/match-score-widget";
import { MatchNotesPanel } from "@/components/partner/match-notes-panel";
import { PartnerDeclineButton } from "@/components/partner/decline-button";
import { InvitePanel } from "@/components/partner/invite-panel";
import { listMatchNotes } from "@/lib/actions/match-notes";
import { QaSectionPartner } from "@/components/brief/qa-section-partner";
import { DealReportForm } from "@/components/partner/deal-report-form";
import { PartnerMeetingPicker } from "@/components/partner/partner-meeting-picker";
import { PartnerFileUpload } from "@/components/partner/partner-file-upload";

export const dynamic = "force-dynamic";

export default async function PartnerBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect("/partner/login");

  const match = await queryOne<MatchRow>(
    'SELECT * FROM "Match" WHERE "briefId" = $1 AND "partnerId" = $2',
    [id, session.user.companyId],
  );
  if (!match) redirect("/partner");

  const brief = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
    [id],
  );
  if (!brief) redirect("/partner");

  const p = await queryOne<ProposalRow>(
    'SELECT * FROM "Proposal" WHERE "matchId" = $1',
    [match.id],
  );
  const proposalSections = p
    ? await query<ProposalSectionRow>(
        'SELECT * FROM "ProposalSection" WHERE "proposalId" = $1',
        [p.id],
      )
    : [];

  // Slice S4 — partner sidebar widgets need partner profile + notes.
  const [companyRow, notes] = await Promise.all([
    queryOne<CompanyRow>('SELECT * FROM "Company" WHERE "id" = $1', [
      session.user.companyId,
    ]),
    listMatchNotes(match.id),
  ]);
  const partnerProfile = companyRow
    ? await queryOne<PartnerProfileRow>(
        'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
        [companyRow.id],
      )
    : null;
  const partnerCompany = companyRow
    ? { ...companyRow, partnerProfile }
    : null;

  const scope = safeJsonParse<Array<{ title: string; detail: string }>>(
    brief.scopeRequirements,
    [],
  );
  const timeline = safeJsonParse<Array<{ title: string; date: string }>>(
    brief.milestones,
    [],
  );
  const services = safeJsonParse<ServiceCategory[]>(brief.services, []);
  const bucket = getPartnerWorkspaceBucket(match.status, p?.status ?? null);
  const backHref =
    bucket === "opportunities"
      ? "/partner/opportunities"
      : bucket === "won"
        ? "/partner/won"
        : "/partner/pipeline";
  const backLabel =
    bucket === "opportunities"
      ? "Opportunities"
      : bucket === "won"
        ? "Won"
        : "Pipeline";
  const statusLabel = getPartnerStatusLabel(match.status, p?.status ?? null);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <div className="space-y-5 border-b border-line pb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit text-muted-foreground hover:text-foreground">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            Back to {backLabel}
          </Link>
        </Button>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-1 text-[10.5px] font-semibold text-primary">
                {statusLabel}
              </Badge>
              <span className="text-[11.5px] text-muted-foreground">{services.length} required {services.length === 1 ? "service" : "services"}</span>
            </div>
            <h1 className="text-balance text-[28px] font-semibold leading-[1.12] tracking-[-0.025em] text-foreground sm:text-[34px]">
              {brief.title}
            </h1>
            {brief.anonymizedCompanySummary && (
              <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                {brief.anonymizedCompanySummary}
              </p>
            )}
          </div>
          <PartnerDeclineButton
            matchId={match.id}
            matchStatus={match.status}
            briefTitle={brief.title}
          />
        </div>
      </div>

      {/* plan-A M6 — invite lifecycle (T1/T2 deadlines, extension) */}
      <InvitePanel
        matchId={match.id}
        briefId={brief.id}
        status={match.status}
        acceptDeadlineAt={match.acceptDeadlineAt?.toISOString() ?? null}
        proposalDeadlineAt={match.proposalDeadlineAt?.toISOString() ?? null}
        extensionUsed={match.extensionUsed}
        anonymizedCompanySummary={brief.anonymizedCompanySummary}
      />

      {/* Partner meeting picker — propose slots after accepting */}
      {(match.status === "PARTNER_ACCEPTED" || match.status === "EXTENSION_REQUESTED") && (
        <PartnerMeetingPicker
          matchId={match.id}
          briefId={brief.id}
          hasProposed={Boolean(
            safeJsonParse(match.meetingProposedSlots, null as unknown),
          )}
          confirmedAt={match.meetingConfirmedAt?.toISOString() ?? null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="relative overflow-hidden border-line bg-card shadow-elev-1">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-primary"></div>
            <CardHeader className="border-b border-line bg-card p-5 sm:p-6">
              <CardTitle className="flex items-center gap-3 text-[16px] font-semibold tracking-tight text-foreground">
                <FileText className="h-5 w-5 text-primary" /> Customer brief
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Project overview
                </h3>
                <p className="text-[13.5px] leading-relaxed text-foreground">
                  {brief.executiveSummary || "No overview provided."}
                </p>
              </div>

              <div className="border-t border-line"></div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Scope requirements
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {scope.map((s, i) => (
                    <div key={i} className="rounded-xl border border-border bg-surface-sunk p-4 transition-colors hover:border-primary/25 hover:bg-primary/5">
                      <div className="mb-2 font-mono text-[11px] text-primary">REQ-0{i+1}</div>
                      <div className="mb-1.5 text-[13.5px] font-semibold text-foreground">{s.title}</div>
                      <div className="text-[12.5px] leading-relaxed text-muted-foreground">{s.detail}</div>
                    </div>
                  ))}
                  {scope.length === 0 && (
                    <div className="text-sm italic text-muted-foreground sm:col-span-2">No scope requirements defined.</div>
                  )}
                </div>
              </div>

              <div className="border-t border-line"></div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Delivery timeline
                </h3>
                <div className="space-y-2">
                  {timeline.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-primary/5">
                      <span className="text-[13px] font-medium text-foreground">{m.title}</span>
                      <Badge variant="outline" className="shrink-0 border-border bg-card font-mono text-[11px] text-primary">
                        {m.date}
                      </Badge>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <div className="text-sm italic text-muted-foreground">No timeline data available.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-line bg-card shadow-elev-1">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Procurement
                  </div>
                  <div className="text-[14px] font-semibold capitalize text-foreground">
                    {brief.procurement.replace("_", " ").toLowerCase()}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Required services
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => (
                      <Badge key={s} variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                        {SERVICE_CATEGORIES_LABEL[s]}
                      </Badge>
                    ))}
                    {services.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Partner file uploads — questionnaires and proposal documents */}
          {(match.status === "PARTNER_ACCEPTED" ||
            match.status === "EXTENSION_REQUESTED" ||
            match.status === "PROPOSAL_SUBMITTED" ||
            match.status === "QC_PASSED") && (
            <div className="space-y-4">
              <PartnerFileUpload
                matchId={match.id}
                kind="questionnaire"
                title="Questionnaires"
                description="Upload questionnaires if you need more answers from the customer before finalizing your proposal."
                canUpload={match.status === "PARTNER_ACCEPTED" || match.status === "EXTENSION_REQUESTED"}
              />
              <PartnerFileUpload
                matchId={match.id}
                kind="proposal"
                title="Proposal documents"
                description="Upload your proposal files (PDF, Word, Excel, images). You can submit one or multiple files."
                canUpload={match.status === "PARTNER_ACCEPTED" || match.status === "EXTENSION_REQUESTED"}
              />
            </div>
          )}

          {/* Anonymous partner Q&A — clarifications routed to the customer */}
          <QaSectionPartner
            briefId={brief.id}
            partnerCompanyId={session.user.companyId}
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {partnerCompany && (
            <MatchScoreWidget brief={brief} partner={partnerCompany} />
          )}

          <MatchNotesPanel matchId={match.id} initial={notes} />

          {/* plan-A M11.5 — deal reporting once selected */}
          {match.status === "SELECTED" && (
            <DealReportForm briefId={brief.id} matchId={match.id} />
          )}
        </div>
      </div>

      {/* plan-A M7 — structured proposal builder (post-acceptance) */}
      {["PARTNER_ACCEPTED", "EXTENSION_REQUESTED", "PROPOSAL_SUBMITTED", "QC_PASSED"].includes(
        match.status,
      ) && (
        <Card className="relative overflow-hidden border-line bg-card shadow-elev-1">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary"></div>
          <CardHeader className="border-b border-line bg-card p-5 sm:p-6">
            <CardTitle className="flex items-center gap-3 text-[16px] font-semibold tracking-tight text-foreground">
              <Send className="h-5 w-5 text-primary" /> Proposal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <StructuredProposalBuilder
              matchId={match.id}
              briefId={brief.id}
              proposalStatus={p?.status ?? "DRAFT"}
              initialSections={Object.fromEntries(
                proposalSections.map((s) => [
                  s.key,
                  {
                    content: s.content,
                    pricing: s.pricing
                      ? (JSON.parse(s.pricing) as {
                          model: PricingModel;
                          options: {
                            label: string;
                            amountCents?: number;
                            unit?: string;
                            notes?: string;
                          }[];
                        })
                      : null,
                  },
                ]),
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
