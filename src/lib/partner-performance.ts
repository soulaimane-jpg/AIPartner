import "server-only";

import { query } from "@/lib/db";
import type { PartnerPerformance } from "@/lib/match-score-v2";

/**
 * Delivered-outcome signal for the matching engine.
 *
 * Win/loss, NPS and deal reports were all being captured and then
 * discarded — the platform's own observations never influenced who it
 * recommended next. This loads them so `computeMatchV2` can apply a
 * small, bounded track-record adjustment.
 *
 * Kept separate from `partner-ops.ts` on purpose: that module powers an
 * admin dashboard (rich, per-partner, 90-day window), while this one is
 * a hot path inside scoring and must stay to a couple of grouped
 * queries over a longer window.
 */

/** Outcomes older than this stop being predictive of current delivery. */
const LOOKBACK_DAYS = 365;

export async function loadPartnerPerformance(
  partnerIds: string[],
  { now = new Date(), lookbackDays = LOOKBACK_DAYS } = {},
): Promise<Map<string, PartnerPerformance>> {
  const out = new Map<string, PartnerPerformance>();
  if (partnerIds.length === 0) return out;

  const since = new Date(now.getTime() - lookbackDays * 86_400_000);

  const [proposalRows, dealRows, npsRows] = await Promise.all([
    // Win rate: of the proposals this partner actually submitted, how
    // many did the customer choose?
    query<{ partnerId: string; submitted: number; won: number }>(
      `SELECT "partnerId",
              COUNT(*)::int AS "submitted",
              COUNT(*) FILTER (WHERE "status" = 'SELECTED')::int AS "won"
       FROM "Proposal"
       WHERE "partnerId" = ANY($1)
         AND "submittedAt" IS NOT NULL
         AND "submittedAt" >= $2
       GROUP BY "partnerId"`,
      [partnerIds, since],
    ),
    // Confirmed delivery, which is stronger evidence than selection.
    query<{ partnerId: string; dealsWon: number }>(
      `SELECT m."partnerId", COUNT(*)::int AS "dealsWon"
       FROM "DealReport" d
       JOIN "Match" m ON m."id" = d."matchId"
       WHERE m."partnerId" = ANY($1)
         AND d."outcome" = 'deal'
         AND d."createdAt" >= $2
       GROUP BY m."partnerId"`,
      [partnerIds, since],
    ),
    // CSAT, attributed through the brief the partner was selected on.
    // Only SELECTED matches count: a partner who merely bid should not
    // inherit the score of whoever actually did the work.
    query<{ partnerId: string; avgScore: number; responses: number }>(
      `SELECT m."partnerId",
              AVG(n."score")::float AS "avgScore",
              COUNT(*)::int AS "responses"
       FROM "NpsResponse" n
       JOIN "Match" m ON m."briefId" = n."briefId"
       WHERE m."partnerId" = ANY($1)
         AND m."status" = 'SELECTED'
         AND n."surface" = 'partner.engagement'
         AND n."createdAt" >= $2
       GROUP BY m."partnerId"`,
      [partnerIds, since],
    ),
  ]);

  const proposalsBy = new Map(proposalRows.map((r) => [r.partnerId, r]));
  const dealsBy = new Map(dealRows.map((r) => [r.partnerId, r]));
  const npsBy = new Map(npsRows.map((r) => [r.partnerId, r]));

  for (const partnerId of partnerIds) {
    const p = proposalsBy.get(partnerId);
    const d = dealsBy.get(partnerId);
    const n = npsBy.get(partnerId);

    const submitted = p?.submitted ?? 0;
    const responses = n?.responses ?? 0;

    // No observations at all → omit, so the scorer treats it as
    // neutral rather than as a zero.
    if (submitted === 0 && responses === 0 && !d?.dealsWon) continue;

    out.set(partnerId, {
      winRate: submitted > 0 ? (p!.won ?? 0) / submitted : null,
      csat: responses > 0 ? Number(n!.avgScore) : null,
      proposalsSubmitted: submitted,
      csatResponses: responses,
      dealsWon: d?.dealsWon ?? 0,
    });
  }

  return out;
}
