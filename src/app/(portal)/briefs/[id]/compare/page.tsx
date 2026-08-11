import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isPartnerRevealed } from "@/lib/serializers/firewall";
import { PROPOSAL_SECTIONS, isProposalSectionKey } from "@/lib/sections";
import { ComparisonGrid, type ComparisonColumnDTO } from "./comparison-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare partners · AI Partner" };

/**
 * M10 — the anonymized comparison view. Columns appear in submission
 * order as they're released (stagger-aware); the team votes, the
 * owner selects 1–3 partners, then approves the reveal as a distinct
 * second step. Identity only ever populates for selected partners
 * post-reveal (§8).
 */
export default async function ComparePage({
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
    leadState: string;
    selectionDeadlineAt: Date | null;
  }>(
    `SELECT "id", "title", "leadState", "selectionDeadlineAt"
     FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2`,
    [id, session.user.id],
  );
  if (!brief) notFound();

  const view = await queryOne<{ id: string; status: string }>(
    'SELECT "id", "status" FROM "ComparisonView" WHERE "briefId" = $1',
    [id],
  );
  const released = view?.status === "released";

  const columnsRaw = view
    ? await query<{
        matchId: string;
        placeholderLabel: string;
        submissionRank: number;
      }>(
        `SELECT "matchId", "placeholderLabel", "submissionRank"
         FROM "ComparisonColumn"
         WHERE "viewId" = $1 AND "releasedAt" IS NOT NULL
         ORDER BY "submissionRank" ASC`,
        [view.id],
      )
    : [];
  const cellsRaw = view
    ? await query<{
        placeholderLabel: string;
        sectionKey: string;
        summary: string;
        detail: string | null;
      }>(
        'SELECT "placeholderLabel", "sectionKey", "summary", "detail" FROM "ComparisonCell" WHERE "viewId" = $1',
        [view.id],
      )
    : [];

  // Match context per column (status for reveal gate + votes).
  const matchIds = columnsRaw.map((c) => c.matchId);
  const matchesRows = matchIds.length
    ? await query<{ id: string; status: string; partnerName: string }>(
        `SELECT m."id", m."status", c."name" AS "partnerName"
         FROM "Match" m JOIN "Company" c ON c."id" = m."partnerId"
         WHERE m."id" = ANY($1)`,
        [matchIds],
      )
    : [];
  const matchById = new Map(matchesRows.map((m) => [m.id, m]));

  const voteRows = matchIds.length
    ? await query<{
        matchId: string;
        userId: string;
        value: string;
        comment: string | null;
      }>(
        'SELECT "matchId", "userId", "value", "comment" FROM "ProposalVote" WHERE "matchId" = ANY($1)',
        [matchIds],
      )
    : [];
  const votesByMatch = new Map<string, typeof voteRows>();
  for (const v of voteRows) {
    const arr = votesByMatch.get(v.matchId) ?? [];
    arr.push(v);
    votesByMatch.set(v.matchId, arr);
  }

  const voterIds = [...new Set(voteRows.map((v) => v.userId))];
  const voters = voterIds.length
    ? await query<{ id: string; name: string | null; email: string }>(
        'SELECT "id", "name", "email" FROM "User" WHERE "id" = ANY($1)',
        [voterIds],
      )
    : [];
  const voterById = new Map(voters.map((v) => [v.id, v.name ?? v.email]));

  const cellsByColumn = new Map<string, Record<string, { summary: string; detail: string | null }>>();
  for (const cell of cellsRaw) {
    const bucket = cellsByColumn.get(cell.placeholderLabel) ?? {};
    bucket[cell.sectionKey] = { summary: cell.summary, detail: cell.detail };
    cellsByColumn.set(cell.placeholderLabel, bucket);
  }

  const columns: ComparisonColumnDTO[] = columnsRaw.map((col) => {
    const match = matchById.get(col.matchId);
    const revealed = match
      ? isPartnerRevealed({
          leadState: brief.leadState,
          matchStatus: match.status,
        })
      : false;
    return {
      matchId: col.matchId,
      placeholderLabel: col.placeholderLabel,
      submissionRank: col.submissionRank,
      matchStatus: match?.status ?? "",
      // Firewall: name flows ONLY for revealed (selected + reveal event).
      revealedName: revealed ? (match?.partnerName ?? null) : null,
      cells: cellsByColumn.get(col.placeholderLabel) ?? {},
      votes: (votesByMatch.get(col.matchId) ?? []).map((v) => ({
        voter: voterById.get(v.userId) ?? "Team member",
        mine: v.userId === session.user!.id,
        value: v.value as "yes" | "no",
        comment: v.comment,
      })),
    };
  });

  // Row order: union of section keys across columns, registry-ranked.
  const sectionKeys = [
    ...new Set(columns.flatMap((c) => Object.keys(c.cells))),
  ]
    .filter(isProposalSectionKey)
    .sort((a, b) => PROPOSAL_SECTIONS[a].rank - PROPOSAL_SECTIONS[b].rank);

  return (
    <div className="page-container-wide pt-8 pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Compare partner proposals
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground max-w-2xl">
          Proposals are anonymized — partners appear as
          {" “Partner A/B/C” "}until you select up to 3 and approve the
          mutual reveal. Columns join in submission order.
        </p>
      </header>

      {!released || columns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-elev-1">
          <p className="text-[14px] text-muted-foreground">
            Your comparison isn&apos;t ready yet — proposals go through our
            quality and anonymization review first. We&apos;ll notify you the
            moment the first column is released.
          </p>
        </div>
      ) : (
        <ComparisonGrid
          briefId={brief.id}
          leadState={brief.leadState}
          selectionDeadlineAt={brief.selectionDeadlineAt?.toISOString() ?? null}
          sectionRows={sectionKeys.map((key) => ({
            key,
            label: PROPOSAL_SECTIONS[key].label,
          }))}
          columns={columns}
        />
      )}
    </div>
  );
}
