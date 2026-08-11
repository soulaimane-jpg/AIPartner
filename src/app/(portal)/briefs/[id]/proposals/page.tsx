import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Trophy,
  Sparkles,
  Layers,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne, count } from "@/lib/db";
import type { ProposalRow as ProposalDbRow } from "@/lib/db/rows";
import { Badge } from "@/components/ui/badge";
import { BriefWorkspaceHeader } from "@/components/brief-workspace-header";
import { SelectProposalButton } from "@/components/select-proposal";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BriefStage, BriefStatus } from "@/lib/enums";
import {
  isPartnerRevealed,
  serializeCompanyFacingProposal,
  type CompanyFacingProposalColumn,
} from "@/lib/serializers/firewall";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare proposals · AI Partner" };

export default async function BriefProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const brief = await queryOne<{
    id: string;
    title: string;
    stage: string;
    status: string;
    completion: number;
    leadState: string;
  }>(
    `SELECT "id", "title", "stage", "status", "completion", "leadState"
     FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2`,
    [id, session.user.id],
  );
  if (!brief) notFound();

  const proposalRows = await query<
    ProposalDbRow & {
      matchStatus: string | null;
      matchPlaceholderLabel: string | null;
      partnerName: string;
      partnerTagline: string | null;
      partnerTier: string | null;
    }
  >(
    `SELECT p.*,
            m."status" AS "matchStatus",
            m."placeholderLabel" AS "matchPlaceholderLabel",
            c."name" AS "partnerName",
            pp."tagline" AS "partnerTagline",
            pp."tier" AS "partnerTier"
     FROM "Proposal" p
     JOIN "Match" m ON m."id" = p."matchId"
     JOIN "Company" c ON c."id" = p."partnerId"
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE p."briefId" = $1 AND p."status" <> 'DRAFT'
     ORDER BY p."submittedAt" ASC`,
    [id],
  );
  const sourcedCount = await count(
    `SELECT COUNT(*) FROM "Match" WHERE "briefId" = $1 AND "status" = 'SOURCED'`,
    [id],
  );

  // Identity firewall (plan-A §8): partner identity flows to the
  // company ONLY for selected partners after the reveal event. All
  // other columns render under their stable placeholder label.
  const proposals: CompanyFacingProposalColumn[] = proposalRows.map(
    (p, index) => {
      const revealed = isPartnerRevealed({
        leadState: brief.leadState,
        matchStatus: p.matchStatus ?? "",
        proposalStatus: p.status,
      });
      return serializeCompanyFacingProposal(
        {
          proposal: p,
          match: {
            id: p.matchId,
            placeholderLabel: p.matchPlaceholderLabel,
            status: p.matchStatus ?? "",
          },
          partner: revealed
            ? {
                name: p.partnerName,
                tagline: p.partnerTagline ?? null,
                tier: p.partnerTier ?? null,
              }
            : { name: "", tier: p.partnerTier ?? null },
          submissionRank: index + 1,
          fallbackIndex: index,
        },
        { revealed },
      );
    },
  );
  const winner = proposals.find((p) => p.status === "SELECTED");
  const stats = computeStats(proposals);

  return (
    <div className="page-container-wide pt-6 pb-20">
      <BriefWorkspaceHeader
        briefId={brief.id}
        title={brief.title}
        stage={brief.stage as BriefStage}
        status={brief.status as BriefStatus}
        completion={brief.completion}
        proposalsCount={proposals.length}
        hasMatches={sourcedCount > 0}
      />

      <div className="mt-6 space-y-6">
        {/* Hero stats */}
        <div className="grid gap-3 sm:grid-cols-4">
          <KpiTile
            icon={<Layers className="h-4 w-4" />}
            label="Proposals received"
            value={proposals.length.toString()}
          />
          <KpiTile
            icon={<DollarSign className="h-4 w-4" />}
            label="Lowest cost"
            value={stats.lowestCost ? formatCurrency(stats.lowestCost) : "—"}
            tone="emerald"
          />
          <KpiTile
            icon={<Calendar className="h-4 w-4" />}
            label="Fastest timeline"
            value={stats.fastestWeeks ? `${stats.fastestWeeks} weeks` : "—"}
            tone="cyan"
          />
          <KpiTile
            icon={<Trophy className="h-4 w-4" />}
            label="Decision"
            value={winner ? "Selected" : "Pending"}
            tone={winner ? "amber" : "muted"}
          />
        </div>

        {proposals.length === 0 ? (
          <EmptyProposals />
        ) : (
          <>
            {/* Comparison table — desktop */}
            <ProposalCompareTable
              proposals={proposals.map((p) => ({
                id: p.proposalId,
                partnerName: p.displayLabel,
                tagline: p.revealedTagline ?? "Anonymized until you select & reveal",
                tier: p.tier ?? "PARTNER",
                submittedFirst: p.submittedFirst,
                summary: p.summary,
                approach: p.approach,
                timelineWeeks: p.timelineWeeks,
                totalCost: p.totalCost,
                status: p.status,
                strengths: p.strengths,
                team: p.team,
              }))}
              briefId={brief.id}
              winnerId={winner?.proposalId ?? null}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────── */

function KpiTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "emerald" | "cyan" | "amber" | "muted";
}) {
  const accent =
    "bg-secondary/60 text-muted-foreground border-border";
  // unused tone branches retained for API compatibility
  void tone;
  return (
    <div className="rounded-2xl bg-card border border-border shadow-elev-1 p-4">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-8 w-8 place-items-center rounded-md border", accent)}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-foreground truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

type ProposalRow = {
  id: string;
  partnerName: string;
  tagline: string;
  tier: string;
  submittedFirst?: boolean;
  summary: string;
  approach: string;
  timelineWeeks: number;
  totalCost: number;
  status: string;
  strengths: string[];
  team: { role: string; seniority?: string; count?: number }[];
};

function ProposalCompareTable({
  proposals,
  briefId,
  winnerId,
}: {
  proposals: ProposalRow[];
  briefId: string;
  winnerId: string | null;
}) {
  const lowestCost = Math.min(...proposals.map((p) => p.totalCost));
  const fastestWeeks = Math.min(...proposals.map((p) => p.timelineWeeks));

  return (
    <div className="rounded-2xl bg-card border border-border shadow-elev-1 overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-[14.5px] font-semibold text-foreground">
              Side‑by‑side comparison
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {winnerId
                ? "Decision recorded — partners notified."
                : "Pick the partner that best fits your needs. You can request meetings before deciding."}
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[920px]">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              <th className="text-left px-5 py-3 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground sticky left-0 bg-secondary/40 z-10 w-[160px]">
                Criterion
              </th>
              {proposals.map((p) => (
                <th
                  key={p.id}
                  className={cn(
                    "text-left px-5 py-3 align-bottom min-w-[260px] border-l border-border",
                    p.id === winnerId && "bg-secondary/40",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-foreground">{p.partnerName}</span>
                    {p.id === winnerId && (
                      <Badge variant="success" className="text-[10px] uppercase tracking-wider">
                        <Trophy className="h-2.5 w-2.5" /> Selected
                      </Badge>
                    )}
                    {p.submittedFirst && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        Submitted first
                      </Badge>
                    )}
                    {p.tier === "PREMIER" && p.id !== winnerId && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        Premier
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground font-normal truncate">
                    {p.tagline}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row
              label="Total cost"
              icon={<DollarSign className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) => (
                <span
                  className={cn(
                    "font-mono font-semibold text-[13px]",
                    p.totalCost === lowestCost ? "text-emerald-700" : "text-foreground",
                  )}
                >
                  {formatCurrency(p.totalCost)}
                  {p.totalCost === lowestCost && proposals.length > 1 && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-emerald-700/80">lowest</span>
                  )}
                </span>
              )}
            />
            <Row
              label="Timeline"
              icon={<Calendar className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) => (
                <span className="font-mono font-semibold text-[13px] text-foreground">
                  {p.timelineWeeks} weeks
                  {p.timelineWeeks === fastestWeeks && proposals.length > 1 && (
                    <span className="ml-1.5 text-[10px] tracking-wider text-muted-foreground">fastest</span>
                  )}
                </span>
              )}
            />
            <Row
              label="Team size"
              icon={<Users className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) => (
                <span className="text-foreground tabular-nums">
                  {p.team.reduce((s, t) => s + (t.count ?? 1), 0)} people
                </span>
              )}
            />
            <Row
              label="Squad"
              icon={<Users className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) =>
                p.team.length === 0 ? (
                  <span className="text-muted-foreground italic text-[12px]">Not specified</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {p.team.slice(0, 4).map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-mono text-muted-foreground bg-secondary border border-border rounded px-1.5 py-0.5"
                      >
                        {t.count ?? 1}× {t.role}
                      </span>
                    ))}
                    {p.team.length > 4 && (
                      <span className="text-[11px] text-muted-foreground">+{p.team.length - 4}</span>
                    )}
                  </div>
                )
              }
            />
            <Row
              label="Strengths"
              icon={<Sparkles className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) =>
                p.strengths.length === 0 ? (
                  <span className="text-muted-foreground italic text-[12px]">—</span>
                ) : (
                  <ul className="space-y-1.5">
                    {p.strengths.slice(0, 4).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-foreground/85 leading-relaxed">
                        <CheckCircle2 className="h-3 w-3 text-foreground/70 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )
              }
            />
            <Row
              label="Approach"
              icon={<Layers className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) =>
                p.approach ? (
                  <p className="text-[12.5px] text-foreground/80 leading-relaxed line-clamp-5">{p.approach}</p>
                ) : (
                  <span className="text-muted-foreground italic text-[12px]">No approach provided.</span>
                )
              }
            />
            <Row
              label="Summary"
              icon={<Sparkles className="h-3 w-3" />}
              proposals={proposals}
              winnerId={winnerId}
              render={(p) => (
                <p className="text-[12.5px] text-foreground/80 leading-relaxed line-clamp-5">{p.summary}</p>
              )}
            />
            {/* Action row */}
            <tr className="bg-secondary/20">
              <td className="px-5 py-4 sticky left-0 bg-secondary/20 z-10 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                Decision
              </td>
              {proposals.map((p) => (
                <td
                  key={p.id}
                  className={cn(
                    "px-5 py-4 border-l border-border",
                    p.id === winnerId && "bg-secondary/40",
                  )}
                >
                  <SelectProposalButton
                    briefId={briefId}
                    proposalId={p.id}
                    selected={p.status === "SELECTED"}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  proposals,
  winnerId,
  render,
}: {
  label: string;
  icon: React.ReactNode;
  proposals: ProposalRow[];
  winnerId: string | null;
  render: (p: ProposalRow) => React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="px-5 py-3 align-top sticky left-0 bg-card z-10 border-r border-border min-w-[160px] w-[160px]"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          {icon}
          {label}
        </span>
      </th>
      {proposals.map((p) => (
        <td
          key={p.id}
          className={cn(
            "px-5 py-3 align-top border-l border-border",
            p.id === winnerId && "bg-secondary/40",
          )}
        >
          {render(p)}
        </td>
      ))}
    </tr>
  );
}

function EmptyProposals() {
  return (
    <div className="rounded-md border border-dashed border-border p-10 text-center">
      <h3 className="text-[14px] font-medium text-foreground">Awaiting proposals</h3>
      <p className="mt-1.5 text-[13px] text-muted-foreground max-w-md mx-auto">
        Approved partners are reviewing your brief now. We&apos;ll notify you the moment a proposal arrives —
        usually within 3–5 business days.
      </p>
    </div>
  );
}

function computeStats(
  proposals: { totalCost: number | null; timelineWeeks: number | null }[],
): { lowestCost: number | null; fastestWeeks: number | null } {
  if (proposals.length === 0) return { lowestCost: null, fastestWeeks: null };
  const costs = proposals.map((p) => p.totalCost ?? Infinity).filter((c) => c !== Infinity);
  const weeks = proposals.map((p) => p.timelineWeeks ?? Infinity).filter((c) => c !== Infinity);
  return {
    lowestCost: costs.length > 0 ? Math.min(...costs) : null,
    fastestWeeks: weeks.length > 0 ? Math.min(...weeks) : null,
  };
}
