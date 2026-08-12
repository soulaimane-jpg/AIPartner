import { query } from "@/lib/db";
import { AnonymizationReviewCard } from "./review-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anonymization queue · Admin" };

/**
 * M8b — human anonymization review queue (plan-A §8 Layer 2).
 * Every LLM pass waits here: the reviewer sees original vs anonymized
 * side-by-side plus the replacement list, edits where needed, and
 * approves or rejects. Nothing reaches a customer unapproved.
 */
export default async function AnonymizationQueuePage() {
  const rows = await query<{
    id: string;
    content: string;
    replacedEntities: string;
    proposalId: string;
    placeholderLabel: string;
    briefTitle: string;
    partnerName: string;
  }>(
    `SELECT ap."id", ap."content", ap."replacedEntities", ap."proposalId",
            ap."placeholderLabel", b."title" AS "briefTitle", c."name" AS "partnerName"
     FROM "AnonymizedProposal" ap
     JOIN "Proposal" p ON p."id" = ap."proposalId"
     JOIN "ProjectBrief" b ON b."id" = p."briefId"
     JOIN "Company" c ON c."id" = p."partnerId"
     WHERE ap."status" = 'pending_review'
     ORDER BY ap."createdAt" ASC`,
  );
  const proposalIds = rows.map((r) => r.proposalId);
  const sectionRows = proposalIds.length
    ? await query<{ proposalId: string; key: string; content: string }>(
        `SELECT "proposalId", "key", "content" FROM "ProposalSection"
         WHERE "proposalId" = ANY($1) ORDER BY "rank" ASC`,
        [proposalIds],
      )
    : [];
  const sectionsByProposal = new Map<string, { key: string; content: string }[]>();
  for (const s of sectionRows) {
    const arr = sectionsByProposal.get(s.proposalId) ?? [];
    arr.push({ key: s.key, content: s.content });
    sectionsByProposal.set(s.proposalId, arr);
  }

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title">
          Anonymization queue
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground max-w-2xl">
          Review each LLM anonymization pass before it can join a customer
          comparison. Check for <strong>missed identities</strong> and{" "}
          <strong>over-redactions</strong> — the replacement list shows every
          change the model made.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="customer-panel border-dashed p-10 text-center">
          <p className="text-[13.5px] text-muted-foreground">
            Queue is clear — QC-passed proposals appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row) => {
            let anonSections: Record<string, string> = {};
            let replacements: {
              original: string;
              replacement: string;
              entityType: string;
            }[] = [];
            try {
              anonSections = JSON.parse(row.content);
            } catch {
              anonSections = {};
            }
            try {
              replacements = JSON.parse(row.replacedEntities);
            } catch {
              replacements = [];
            }
            return (
              <AnonymizationReviewCard
                key={row.id}
                anonymizedProposalId={row.id}
                proposalId={row.proposalId}
                briefTitle={row.briefTitle}
                partnerName={row.partnerName}
                placeholderLabel={row.placeholderLabel}
                originalSections={Object.fromEntries(
                  (sectionsByProposal.get(row.proposalId) ?? []).map((s) => [
                    s.key,
                    s.content,
                  ]),
                )}
                anonymizedSections={anonSections}
                replacements={replacements}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
