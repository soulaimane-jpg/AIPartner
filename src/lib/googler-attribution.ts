import "server-only";

import { query, queryOne } from "@/lib/db";

/**
 * Referral attribution for Googlers.
 *
 * The referral path existed (Lead + invite token + claim) but stopped
 * at "claimed" — a Googler could see that someone signed up and
 * nothing after that, so there was no way to tell whether referring
 * customers to AI Partner was actually worth doing.
 *
 * This traces each referred customer through to briefs, meetings and
 * delivered engagements.
 *
 * Firewall note: a Googler sees the progress of *their own referred
 * customer*, which is the relationship they already own. They do not
 * see partner identities, proposal contents, or pricing.
 */

export interface GooglerAttributionSummary {
  invited: number;
  claimed: number;
  briefsCreated: number;
  briefsSubmitted: number;
  meetingsScheduled: number;
  engagementsAccepted: number;
  /** Total accepted contract value across referred customers, in cents. */
  influencedValueCents: number;
}

export interface GooglerReferralOutcome {
  leadId: string;
  companyName: string | null;
  customerDomain: string;
  status: string;
  invitedAt: Date;
  claimedAt: Date | null;
  briefCount: number;
  /** Furthest pipeline position reached across their briefs. */
  furthestStage: string | null;
  engagementsAccepted: number;
  influencedValueCents: number;
}

/** Ordered by pipeline progress so "furthest reached" is comparable. */
const LEAD_PROGRESS: readonly string[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_TRIAGE",
  "CLARIFICATION_NEEDED",
  "LEAD_APPROVED",
  "PARTNERS_SELECTED",
  "SENT_TO_PARTNERS",
  "PROPOSALS_IN_REVIEW",
  "COMPARISON_RELEASED",
  "COMPANY_SELECTED",
  "REVEAL_APPROVED",
  "MEETINGS_SCHEDULED",
  "COMPLETED",
];

export async function getGooglerAttribution(googlerId: string): Promise<{
  summary: GooglerAttributionSummary;
  referrals: GooglerReferralOutcome[];
}> {
  const rows = await query<{
    leadId: string;
    companyName: string | null;
    customerDomain: string;
    status: string;
    invitedAt: Date;
    claimedAt: Date | null;
    claimedUserId: string | null;
    briefCount: number;
    leadStates: string[] | null;
    engagementsAccepted: number;
    influencedValueCents: string | null;
  }>(
    `SELECT l."id"              AS "leadId",
            l."companyName",
            l."customerDomain",
            l."status",
            l."invitedAt",
            l."claimedAt",
            l."claimedUserId",
            COALESCE(b."briefCount", 0)::int      AS "briefCount",
            b."leadStates",
            COALESCE(e."accepted", 0)::int        AS "engagementsAccepted",
            COALESCE(e."value", 0)::text          AS "influencedValueCents"
       FROM "Lead" l
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS "briefCount",
                ARRAY_AGG(pb."leadState") AS "leadStates"
           FROM "ProjectBrief" pb
          WHERE pb."ownerId" = l."claimedUserId"
       ) b ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS "accepted",
                SUM(COALESCE(en."contractValueCents", 0)) AS "value"
           FROM "Engagement" en
           JOIN "ProjectBrief" pb2 ON pb2."id" = en."briefId"
          WHERE pb2."ownerId" = l."claimedUserId"
            AND en."acceptedAt" IS NOT NULL
       ) e ON TRUE
      WHERE l."googlerId" = $1
      ORDER BY l."invitedAt" DESC`,
    [googlerId],
  );

  const referrals: GooglerReferralOutcome[] = rows.map((r) => {
    const states = (r.leadStates ?? []).filter(Boolean);
    let furthest: string | null = null;
    let furthestIdx = -1;
    for (const s of states) {
      const idx = LEAD_PROGRESS.indexOf(s);
      if (idx > furthestIdx) {
        furthestIdx = idx;
        furthest = s;
      }
    }
    return {
      leadId: r.leadId,
      companyName: r.companyName,
      customerDomain: r.customerDomain,
      status: r.status,
      invitedAt: r.invitedAt,
      claimedAt: r.claimedAt,
      briefCount: r.briefCount,
      furthestStage: furthest,
      engagementsAccepted: r.engagementsAccepted,
      influencedValueCents: Number(r.influencedValueCents ?? 0),
    };
  });

  const reached = (state: string) =>
    referrals.filter((r) => {
      const idx = r.furthestStage
        ? LEAD_PROGRESS.indexOf(r.furthestStage)
        : -1;
      return idx >= LEAD_PROGRESS.indexOf(state);
    }).length;

  return {
    summary: {
      invited: referrals.length,
      claimed: referrals.filter((r) => r.claimedAt).length,
      briefsCreated: referrals.reduce((a, r) => a + r.briefCount, 0),
      briefsSubmitted: reached("SUBMITTED"),
      meetingsScheduled: reached("MEETINGS_SCHEDULED"),
      engagementsAccepted: referrals.reduce(
        (a, r) => a + r.engagementsAccepted,
        0,
      ),
      influencedValueCents: referrals.reduce(
        (a, r) => a + r.influencedValueCents,
        0,
      ),
    },
    referrals,
  };
}

/** Whether this Googler has referred anyone at all — cheap gate for UI. */
export async function hasReferrals(googlerId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    'SELECT "id" FROM "Lead" WHERE "googlerId" = $1 LIMIT 1',
    [googlerId],
  );
  return Boolean(row);
}
