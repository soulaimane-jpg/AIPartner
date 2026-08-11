import { query, queryOne } from "@/lib/db";
import type { LeadRow } from "@/lib/db/rows";
import {
  deriveLeadStatus,
  type LeadSnapshot,
} from "@/lib/lead-status";
import type { LeadStatus } from "@/lib/enums";

export type LeadWithStatus = {
  id: string;
  customerEmail: string;
  customerDomain: string;
  customerName: string | null;
  companyName: string | null;
  notes: string | null;
  inviteToken: string;
  status: LeadStatus;
  storedStatus: string;
  invitedAt: Date;
  claimedAt: Date | null;
  claimedUserId: string | null;
  claimedUser:
    | {
        id: string;
        name: string | null;
        email: string;
        company: { name: string } | null;
      }
    | null;
  snapshot: LeadSnapshot;
  mockEmailBody: string | null;
};

/**
 * Fetch a Googler's leads with live-derived status.
 * We don't mutate the stored status here — the stored value is useful for
 * historical auditing, while the derived one is always current.
 */
export async function getGooglerLeads(
  googlerId: string,
): Promise<LeadWithStatus[]> {
  const leads = await query<LeadRow>(
    'SELECT * FROM "Lead" WHERE "googlerId" = $1 ORDER BY "createdAt" DESC',
    [googlerId],
  );
  const withUsers = await Promise.all(leads.map(attachClaimedUser));
  const withSnapshots = await Promise.all(
    withUsers.map(async (lead) => buildLeadWithStatus(lead)),
  );
  return withSnapshots;
}

async function attachClaimedUser(lead: LeadRow) {
  if (!lead.claimedUserId) return { ...lead, claimedUser: null };
  const user = await queryOne<{
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
  }>(
    `SELECT u."id", u."name", u."email", c."name" AS "companyName"
     FROM "User" u LEFT JOIN "Company" c ON c."id" = u."companyId"
     WHERE u."id" = $1`,
    [lead.claimedUserId],
  );
  return {
    ...lead,
    claimedUser: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          company: user.companyName ? { name: user.companyName } : null,
        }
      : null,
  };
}

export async function getLeadForGoogler(
  id: string,
  googlerId: string,
): Promise<LeadWithStatus | null> {
  const lead = await queryOne<LeadRow>(
    'SELECT * FROM "Lead" WHERE "id" = $1 AND "googlerId" = $2',
    [id, googlerId],
  );
  if (!lead) return null;
  return buildLeadWithStatus(await attachClaimedUser(lead));
}

/** A LeadRow with its claiming user resolved, as returned by attachClaimedUser. */
type EnrichedLead = Awaited<ReturnType<typeof attachClaimedUser>>;

async function buildLeadWithStatus(lead: EnrichedLead): Promise<LeadWithStatus> {
  const snapshot = await buildSnapshot(lead);
  const derived = deriveLeadStatus(snapshot);
  return {
    id: lead.id,
    customerEmail: lead.customerEmail,
    customerDomain: lead.customerDomain,
    customerName: lead.customerName,
    companyName: lead.companyName,
    notes: lead.notes,
    inviteToken: lead.inviteToken,
    status: derived,
    storedStatus: lead.status,
    invitedAt: lead.invitedAt,
    claimedAt: lead.claimedAt,
    claimedUserId: lead.claimedUserId,
    claimedUser: lead.claimedUser
      ? {
          id: lead.claimedUser.id,
          name: lead.claimedUser.name,
          email: lead.claimedUser.email,
          company: lead.claimedUser.company
            ? { name: lead.claimedUser.company.name }
            : null,
        }
      : null,
    snapshot,
    mockEmailBody: lead.mockEmailBody,
  };
}

async function buildSnapshot(lead: EnrichedLead): Promise<LeadSnapshot> {
  const base: LeadSnapshot = {
    claimed: !!lead.claimedUserId,
    hasBrief: false,
    briefSubmitted: false,
    matchedCount: 0,
    proposalCount: 0,
    meetingScheduled: false,
    selectedProposal: false,
  };
  if (!lead.claimedUserId) return base;

  const briefs = await query<{
    id: string;
    stage: string;
    matchCount: string;
    proposalCount: string;
    selectedCount: string;
  }>(
    `SELECT b."id", b."stage",
            (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id") AS "matchCount",
            (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id") AS "proposalCount",
            (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id" AND p."status" = 'SELECTED') AS "selectedCount"
     FROM "ProjectBrief" b
     WHERE b."ownerId" = $1`,
    [lead.claimedUserId],
  );

  if (briefs.length === 0) return base;
  base.hasBrief = true;

  // A brief is "submitted" once it has moved past INTAKE.
  base.briefSubmitted = briefs.some((b) => b.stage && b.stage !== "INTAKE");
  base.matchedCount = briefs.reduce((acc, b) => acc + Number(b.matchCount), 0);
  base.proposalCount = briefs.reduce(
    (acc, b) => acc + Number(b.proposalCount),
    0,
  );
  base.meetingScheduled = briefs.some(
    (b) => b.stage === "INTRODUCTION" || b.stage === "SELECTION",
  );
  base.selectedProposal = briefs.some((b) => Number(b.selectedCount) > 0);

  return base;
}
