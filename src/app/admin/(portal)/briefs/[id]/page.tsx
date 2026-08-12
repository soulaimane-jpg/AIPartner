import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileText } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import type {
  ProjectBriefRow,
  CompanyRow,
  PartnerProfileRow,
} from "@/lib/db/rows";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pipeline } from "@/components/pipeline";
import type { BriefStage } from "@/lib/enums";
import { AdminStageControls } from "@/components/admin-controls";
import { AdminPartnerMatchList } from "@/components/admin-partner-match-list";
import { InviteControls } from "@/components/admin/invite-controls";
import { QcControls } from "@/components/admin/qc-controls";
import { getLeadState } from "@/lib/state-machine/lead";
import { AnonymizedCustomerProfileCard } from "@/components/anon-customer-profile";
import {
  SourcePartnersWizard,
  type PartnerCandidate,
} from "@/components/admin/source-partners-wizard";
import { ScheduleMeetingButton } from "@/components/admin/schedule-meeting-button";
import { STAGE_LABELS } from "@/lib/constants";
import { safeJsonParse, cn } from "@/lib/utils";
import { computeMatch } from "@/lib/match-score";
import { scorePartnersForBrief } from "@/lib/match-load";

export const dynamic = "force-dynamic";

export default async function AdminBriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await queryOne<
    ProjectBriefRow & {
      companyName: string;
      anonymizedProfile: string | null;
      ownerName: string | null;
      ownerEmail: string | null;
      comparisonStatus: string | null;
    }
  >(
    `SELECT b.*, c."name" AS "companyName", cp."anonymizedProfile",
            u."name" AS "ownerName", u."email" AS "ownerEmail",
            cv."status" AS "comparisonStatus"
     FROM "ProjectBrief" b
     JOIN "Company" c ON c."id" = b."companyId"
     LEFT JOIN "CustomerProfile" cp ON cp."companyId" = b."companyId"
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     LEFT JOIN "ComparisonView" cv ON cv."briefId" = b."id"
     WHERE b."id" = $1`,
    [id],
  );
  if (!brief) notFound();

  const matches = await query<{
    id: string;
    partnerId: string;
    status: string;
    placeholderLabel: string | null;
    acceptDeadlineAt: Date | null;
    proposalDeadlineAt: Date | null;
    extensionUsed: boolean;
    extensionNote: string | null;
    partnerName: string;
    proposalId: string | null;
    proposalStatus: string | null;
    proposalSubmittedAt: Date | null;
    anonymizationStatus: string | null;
  }>(
    `SELECT m."id", m."partnerId", m."status", m."placeholderLabel",
            m."acceptDeadlineAt", m."proposalDeadlineAt", m."extensionUsed", m."extensionNote",
            pc."name" AS "partnerName",
            p."id" AS "proposalId", p."status" AS "proposalStatus",
            p."submittedAt" AS "proposalSubmittedAt",
            ap."status" AS "anonymizationStatus"
     FROM "Match" m
     JOIN "Company" pc ON pc."id" = m."partnerId"
     LEFT JOIN "Proposal" p ON p."matchId" = m."id"
     LEFT JOIN "AnonymizedProposal" ap ON ap."proposalId" = p."id"
     WHERE m."briefId" = $1`,
    [id],
  );

  const partnerCompanies = await query<CompanyRow>(
    `SELECT * FROM "Company" WHERE "kind" = 'PARTNER' ORDER BY "name" ASC`,
  );
  const partnerProfiles = await query<PartnerProfileRow>(
    `SELECT pp.* FROM "PartnerProfile" pp
     JOIN "Company" c ON c."id" = pp."companyId"
     WHERE c."kind" = 'PARTNER'`,
  );
  const profileByCompany = new Map(
    partnerProfiles.map((pp) => [pp.companyId, pp]),
  );
  const partners = partnerCompanies.map((c) => ({
    ...c,
    partnerProfile: profileByCompany.get(c.id) ?? null,
  }));

  const anonProfile = (() => {
    try {
      return brief.anonymizedProfile ? JSON.parse(brief.anonymizedProfile) : null;
    } catch {
      return null;
    }
  })();

  const assignedIds = new Set(matches.map((m) => m.partnerId));

  // Tag-based scoring where the partner has structured data, legacy string
  // overlap otherwise. One shared call so both the triage list and the source-5
  // wizard rank identically — they previously each recomputed independently.
  const unified = await scorePartnersForBrief(brief, partners);

  const scoredPartners = partners.map((p) => {
    const m = unified.get(p.id)!;
    const legacy = computeMatch({ brief, partner: p });
    return {
      id: p.id,
      name: p.name,
      tagline: p.partnerProfile?.tagline ?? null,
      score: m.score,
      label: m.label,
      reasons: m.reasons,
      // Specialization chips still come from the legacy breakdown: they display
      // human-readable names, whereas the tag engine works in ids.
      matchedSpecs: legacy.components.specializations.matched,
      missingSpecs: legacy.components.specializations.missing,
      assigned: assignedIds.has(p.id),
    };
  });

  // Build the full candidate list (sorted by match score desc) for the
  // source-5 wizard. We surface up to 25 candidates.
  const candidatesRanked = partners
    .map((p) => {
      const m = unified.get(p.id)!;
      return {
        id: p.id,
        name: p.name,
        tagline: p.partnerProfile?.tagline ?? null,
        tier: p.partnerProfile?.tier ?? null,
        headquarters: p.partnerProfile?.headquarters ?? null,
        languages: safeJsonParse<string[]>(p.partnerProfile?.languages ?? "[]", []),
        specializations: safeJsonParse<string[]>(
          p.partnerProfile?.specializations ?? "[]",
          [],
        ),
        expertiseAreas: safeJsonParse<string[]>(
          p.partnerProfile?.expertiseAreas ?? "[]",
          [],
        ),
        // Fall back to a synthesized address if no routing email is set.
        defaultEmail:
          p.partnerProfile?.leadRoutingEmail ??
          `sales@${(p.name ?? "partner")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")}.example`,
        matchScore: m.score,
        matchLabel: m.label,
        eligible: m.eligible,
        gates: m.gates,
      } satisfies PartnerCandidate;
    })
    // Gated partners rank last but stay visible — an admin may know something
    // the structured data doesn't and should be able to override.
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.matchScore - a.matchScore;
    })
    .slice(0, 25);

  const scope = safeJsonParse<{ title: string; detail: string }[]>(
    brief.scopeRequirements,
    [],
  );

  // Partner options for the Schedule Meeting dialog — prefer partners
  // already matched to the brief; fall back to the full directory.
  const matchedPartnerOptions = matches.map((m) => ({
    id: m.partnerId,
    name: m.partnerName,
  }));
  const allPartnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  // plan-A M6 — invite pipeline state + rows.
  const leadState = (await getLeadState(brief.id)) ?? "DRAFT";
  const qcRows = matches
    .filter((m) => m.proposalId)
    .map((m) => ({
      proposalId: m.proposalId!,
      partnerName: m.partnerName,
      placeholderLabel: m.placeholderLabel,
      status: m.proposalStatus!,
      submittedAt: m.proposalSubmittedAt?.toISOString() ?? null,
      anonymizationStatus: m.anonymizationStatus ?? null,
    }));
  const inviteRows = matches.map((m) => ({
    matchId: m.id,
    partnerId: m.partnerId,
    partnerName: m.partnerName,
    placeholderLabel: m.placeholderLabel,
    status: m.status,
    acceptDeadlineAt: m.acceptDeadlineAt?.toISOString() ?? null,
    proposalDeadlineAt: m.proposalDeadlineAt?.toISOString() ?? null,
    extensionUsed: m.extensionUsed,
    extensionNote: m.extensionNote,
  }));

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
          <Link href="/admin/briefs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="portal-page-title">{brief.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-primary font-bold">{brief.companyName}</span>
            <span>•</span>
            <span>{brief.ownerEmail}</span>
            <span>•</span>
            <span>ID: {brief.id.substring(0, 8)}</span>
          </div>
        </div>
        <div className="shrink-0">
          <ScheduleMeetingButton
            brief={{
              id: brief.id,
              title: brief.title,
              customerName: brief.ownerName ?? brief.companyName,
              customerEmail: brief.ownerEmail ?? null,
              matchedPartners:
                matchedPartnerOptions.length > 0
                  ? matchedPartnerOptions
                  : undefined,
            }}
            partners={allPartnerOptions}
            label="Schedule meeting"
            variant="default"
            size="sm"
          />
        </div>
      </header>

      <Card className="customer-panel relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>
        <CardContent className="p-5">
          <Pipeline stage={brief.stage as BriefStage} />
        </CardContent>
      </Card>

      {/* Triage shortcut — only relevant before sourcing starts */}
      {brief.submittedAt && !brief.triagedAt && (
        <Card className="bg-amber-50 border-amber-200 shadow-sm">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-amber-900 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                This brief is awaiting triage
              </h3>
              <p className="text-[12.5px] text-amber-900/80 mt-1">
                Confirm the alignment-meeting slot, capture context gaps, then mark as real lead.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/admin/briefs/${brief.id}/triage`}>
                Open triage
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Source 5 partners — visible once the brief is triaged */}
      {brief.triagedAt && (
        <SourcePartnersWizard
          briefId={brief.id}
          briefTitle={brief.title}
          briefSummary={brief.executiveSummary ?? ""}
          customerIndustry={anonProfile?.industry ?? "Not specified"}
          customerRegion={anonProfile?.region ?? brief.preferredLocation ?? "Not specified"}
          candidates={candidatesRanked}
        />
      )}

      {/* plan-A M6 — invite pipeline (T1/T2, extensions) */}
      <InviteControls
        briefId={brief.id}
        leadState={leadState}
        matches={inviteRows}
      />

      {/* plan-A M8 — QC + comparison build/release */}
      <QcControls
        briefId={brief.id}
        leadState={leadState}
        proposals={qcRows}
        comparisonStatus={brief.comparisonStatus ?? null}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <AnonymizedCustomerProfileCard anon={anonProfile} />

          <Card className="customer-panel bg-card">
            <CardHeader className="customer-panel-header p-5">
              <CardTitle className="text-lg font-bold text-foreground tracking-tight flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" /> Operational Context
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-10">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="text-xs font-semibold  text-foreground/70">Current Phase</div>
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary px-4 py-1 rounded-lg">
                    {STAGE_LABELS[brief.stage]}
                  </Badge>
                </div>
                <div className="space-y-2 text-right">
                  <div className="text-xs font-semibold  text-foreground/70">Sync Status</div>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 px-4 py-1 rounded-lg">
                    ACTIVE
                  </Badge>
                </div>
              </div>

              <div className="h-[1px] bg-card"></div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold  text-foreground/70">Mission Summary</h3>
                <div className="rounded-2xl bg-secondary/40 border border-border p-5 text-foreground/70 text-sm leading-relaxed whitespace-pre-wrap">
                  {brief.executiveSummary ?? (
                    <span className="text-foreground/70">System pending input from discovery session.</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold  text-foreground/70">Technical Scope</h3>
                {scope.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-border rounded-2xl text-xs text-foreground/80 ">
                    [ NO SCOPE NODES DEFINED ]
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {scope.map((s, i) => (
                      <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:bg-primary/5 transition-all group">
                        <div className="text-xs text-primary font-bold mt-1">0{i+1}</div>
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-foreground">{s.title}</div>
                          <div className="text-xs text-muted-foreground leading-normal">{s.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="customer-panel bg-card overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-50"></div>
            <CardHeader className="customer-panel-header p-6">
              <CardTitle className="text-sm font-bold text-foreground ">Protocol Controls</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <AdminStageControls id={brief.id} stage={brief.stage as BriefStage} />
            </CardContent>
          </Card>

          <Card className="customer-panel bg-card">
            <CardHeader className="customer-panel-header p-6">
              <CardTitle className="text-sm font-bold text-foreground  flex items-center justify-between w-full">
                <span>Aligned Partners</span>
                <Badge variant="outline" className="h-5 px-2 border-border text-muted-foreground">{matches.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                {matches.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-border bg-secondary/40 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{m.partnerName}</div>
                      <Badge variant="outline" className="text-[8px] font-semibold uppercase border-border text-muted-foreground px-1.5 py-0">
                        {m.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-foreground/70  flex items-center justify-between">
                      <span>SOW_STATE:</span>
                      <span className={cn(
                        "font-bold",
                        m.proposalStatus ? "text-primary" : "text-foreground"
                      )}>
                        {m.proposalStatus ? m.proposalStatus : "NULL"}
                      </span>
                    </div>
                  </div>
                ))}
                {matches.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-border rounded-2xl text-xs text-foreground/80 ">
                    [ NO NODES ALIGNED ]
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-border">
                <div className="text-xs font-semibold text-foreground/70 mb-4 ml-1">
                  Ranked partner matches
                </div>
                <AdminPartnerMatchList briefId={brief.id} partners={scoredPartners} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
