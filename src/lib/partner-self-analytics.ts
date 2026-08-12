/**
 * Partner-facing self analytics.
 *
 * The same metrics `partner-ops.ts` computes for admins — response
 * time, accept rate, win rate, CSAT — but scoped to the calling
 * partner and paired with an **anonymized** benchmark across the rest
 * of the approved roster, plus a loss-reason breakdown.
 *
 * Firewall (see `src/lib/serializers/firewall.ts`): the benchmark is
 * the second identity boundary of the marketplace. Partners bid
 * against each other, so "who is faster than me" is competitive
 * intelligence, not feedback. Everything returned here is either the
 * caller's own data or a cohort-level statistic — no other partner's
 * id, name, tier or per-competitor row ever leaves this module. The
 * cohort is built by allow-list (aggregate numbers only), the same way
 * the serializers build their DTOs.
 *
 * Metric definitions are kept deliberately identical to
 * `partner-ops.ts` so a partner asking "why does my dashboard differ
 * from what you see?" always has the same answer: it doesn't.
 */

import "server-only";
import { query, queryOne } from "@/lib/db";
import {
  DECLINE_REASON_LABELS,
  type DeclineReason,
} from "@/lib/schemas/decline-reasons";

/**
 * A benchmark is suppressed below this many *other* partners with data.
 * With one or two peers, a median plus the caller's own number is
 * enough to solve for a specific competitor's performance — the small-n
 * case is a de-anonymization hole, not just a noisy statistic.
 */
export const MIN_BENCHMARK_COHORT = 3;

export interface PartnerSelfMetrics {
  proposalsSubmitted: number;
  won: number;
  winRate: number | null;
  acceptRate: number | null;
  medianResponseMs: number | null;
  csat: number | null;
  totalMatches: number;
}

export interface BenchmarkStat {
  /** Median across the other approved partners that have this metric. */
  median: number;
  /**
   * Where the caller sits in that cohort, 0–100 (higher is always
   * better, response time is inverted). Null when the caller has no
   * value of their own to place.
   */
  percentile: number | null;
  /** Cohort size — never below `MIN_BENCHMARK_COHORT`. */
  sampleSize: number;
}

/** Null on every metric where the cohort is too small to anonymize. */
export interface PartnerSelfBenchmarks {
  winRate: BenchmarkStat | null;
  acceptRate: BenchmarkStat | null;
  medianResponseMs: BenchmarkStat | null;
  csat: BenchmarkStat | null;
}

export interface PartnerDeclineBreakdown {
  reason: DeclineReason;
  label: string;
  count: number;
}

export interface PartnerLossReasons {
  /** Why this partner passed on briefs, by structured decline reason. */
  declines: PartnerDeclineBreakdown[];
  declinedTotal: number;
  /** Submitted proposals the customer decided against. */
  proposalsLost: number;
  /** Submitted proposals still awaiting a decision. */
  proposalsPending: number;
}

export interface PartnerSelfAnalytics {
  sinceDays: number;
  since: string;
  metrics: PartnerSelfMetrics;
  benchmarks: PartnerSelfBenchmarks;
  /** How many other approved partners were compared against. */
  cohortSize: number;
  lossReasons: PartnerLossReasons;
}

export interface PartnerSelfAnalyticsOptions {
  /** Defaults to the trailing 90 days, matching the admin dashboard. */
  sinceDays?: number;
}

export function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Mid-rank percentile of `value` within `cohort` (0–100). Ties split
 * evenly so a roster where everyone scores the same lands at 50 rather
 * than 0 or 100.
 */
export function percentileRank(
  value: number,
  cohort: number[],
  higherIsBetter: boolean,
): number {
  if (cohort.length === 0) return 0;
  let better = 0;
  let equal = 0;
  for (const other of cohort) {
    if (other === value) equal++;
    else if (higherIsBetter ? value > other : value < other) better++;
  }
  return Math.round(((better + equal / 2) / cohort.length) * 100);
}

/**
 * Build one benchmark, or null when the cohort is too small to publish.
 * `cohort` must already exclude the caller.
 */
export function buildBenchmark(
  own: number | null,
  cohort: number[],
  higherIsBetter: boolean,
): BenchmarkStat | null {
  if (cohort.length < MIN_BENCHMARK_COHORT) return null;
  return {
    median: median(cohort)!,
    percentile: own == null ? null : percentileRank(own, cohort, higherIsBetter),
    sampleSize: cohort.length,
  };
}

interface MatchRow {
  partnerId: string;
  status: string;
  outreachSentAt: Date | null;
  acceptedTermsAt: Date | null;
  updatedAt: Date;
}

interface ProposalCountRow {
  partnerId: string;
  submitted: number;
  won: number;
}

interface NpsRow {
  partnerId: string;
  avgScore: string | number;
  responses: number;
}

/** Per-partner rollup, used for the caller and for cohort statistics. */
function rollup(
  matches: MatchRow[],
  proposals: ProposalCountRow | undefined,
  npsAvg: number | null,
): PartnerSelfMetrics {
  const responseTimes: number[] = [];
  let accepted = 0;
  let declined = 0;
  for (const m of matches) {
    const sentAt = m.outreachSentAt;
    if (!sentAt) continue;
    if (m.acceptedTermsAt) {
      responseTimes.push(m.acceptedTermsAt.getTime() - sentAt.getTime());
      accepted++;
    } else if (m.status === "PARTNER_DECLINED") {
      responseTimes.push(m.updatedAt.getTime() - sentAt.getTime());
      declined++;
    }
  }
  const decided = accepted + declined;
  const submitted = proposals?.submitted ?? 0;
  const won = proposals?.won ?? 0;

  return {
    proposalsSubmitted: submitted,
    won,
    winRate: submitted > 0 ? won / submitted : null,
    acceptRate: decided > 0 ? accepted / decided : null,
    medianResponseMs: median(responseTimes),
    csat: npsAvg,
    totalMatches: matches.length,
  };
}

export async function getPartnerSelfAnalytics(
  partnerCompanyId: string,
  opts: PartnerSelfAnalyticsOptions = {},
): Promise<PartnerSelfAnalytics> {
  const sinceDays = opts.sinceDays ?? 90;
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  // Cohort = every approved partner. Unapproved companies are excluded
  // because they can't be invited, so their zeroes would drag the
  // benchmark toward a floor nobody actually competes at.
  const cohortRows = await query<{ id: string }>(
    `SELECT "id" FROM "Company"
     WHERE "kind" = 'PARTNER' AND "verificationStatus" = 'APPROVED'`,
  );
  const partnerIds = Array.from(
    new Set([partnerCompanyId, ...cohortRows.map((r) => r.id)]),
  );

  const [matches, proposalCounts, npsRows, declineRows, outcomes] =
    await Promise.all([
      query<MatchRow>(
        `SELECT "partnerId", "status", "outreachSentAt", "acceptedTermsAt", "updatedAt"
         FROM "Match"
         WHERE "partnerId" = ANY($1) AND "createdAt" >= $2`,
        [partnerIds, since],
      ),
      query<ProposalCountRow>(
        `SELECT "partnerId",
                COUNT(*)::int AS "submitted",
                COUNT(*) FILTER (WHERE "status" = 'SELECTED')::int AS "won"
         FROM "Proposal"
         WHERE "partnerId" = ANY($1) AND "submittedAt" >= $2
         GROUP BY "partnerId"`,
        [partnerIds, since],
      ),
      // CSAT is attributed through the briefs a partner actually
      // worked on — engagement NPS on a brief where they accepted.
      query<NpsRow>(
        `SELECT m."partnerId",
                AVG(n."score")::float AS "avgScore",
                COUNT(*)::int AS "responses"
         FROM "NpsResponse" n
         JOIN "Match" m ON m."briefId" = n."briefId"
         WHERE m."partnerId" = ANY($1)
           AND m."acceptedTermsAt" IS NOT NULL
           AND n."surface" = 'partner.engagement'
           AND n."createdAt" >= $2
         GROUP BY m."partnerId"`,
        [partnerIds, since],
      ),
      query<{ declineReason: string; count: number }>(
        `SELECT "declineReason", COUNT(*)::int AS "count"
         FROM "Match"
         WHERE "partnerId" = $1
           AND "status" = 'PARTNER_DECLINED'
           AND "declineReason" IS NOT NULL
           AND "createdAt" >= $2
         GROUP BY "declineReason"
         ORDER BY "count" DESC`,
        [partnerCompanyId, since],
      ),
      // A submitted proposal is "lost" once the customer has closed the
      // door on it: the proposal or match was declined/withdrawn, or a
      // rival proposal on the same brief was selected. Anything else is
      // still in play and must not be counted as a loss.
      queryOne<{ submitted: number; won: number; lost: number }>(
        `SELECT COUNT(*)::int AS "submitted",
                COUNT(*) FILTER (WHERE p."status" = 'SELECTED')::int AS "won",
                COUNT(*) FILTER (
                  WHERE p."status" <> 'SELECTED'
                    AND (
                      p."status" = 'DECLINED'
                      OR m."status" IN ('NOT_SELECTED', 'DECLINED', 'WITHDRAWN')
                      OR EXISTS (
                        SELECT 1 FROM "Proposal" w
                        WHERE w."briefId" = p."briefId"
                          AND w."status" = 'SELECTED'
                          AND w."partnerId" <> p."partnerId"
                      )
                    )
                )::int AS "lost"
         FROM "Proposal" p
         JOIN "Match" m ON m."id" = p."matchId"
         WHERE p."partnerId" = $1 AND p."submittedAt" >= $2`,
        [partnerCompanyId, since],
      ),
    ]);

  const matchesByPartner = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const arr = matchesByPartner.get(m.partnerId) ?? [];
    arr.push(m);
    matchesByPartner.set(m.partnerId, arr);
  }
  const proposalsByPartner = new Map(
    proposalCounts.map((r) => [r.partnerId, r]),
  );
  // Same n ≥ 3 guard the admin dashboard uses: an average over one or
  // two responses says more about the respondent than the partner.
  const csatByPartner = new Map<string, number>();
  for (const row of npsRows) {
    if (row.responses < 3) continue;
    csatByPartner.set(
      row.partnerId,
      Math.round(Number(row.avgScore) * 10) / 10,
    );
  }

  const metricsFor = (id: string) =>
    rollup(
      matchesByPartner.get(id) ?? [],
      proposalsByPartner.get(id),
      csatByPartner.get(id) ?? null,
    );

  const metrics = metricsFor(partnerCompanyId);

  // Cohort statistics only — the per-partner rows are reduced to bare
  // numbers here and never surface in the return value.
  const others = partnerIds
    .filter((id) => id !== partnerCompanyId)
    .map(metricsFor);
  const values = (pick: (m: PartnerSelfMetrics) => number | null) =>
    others.map(pick).filter((v): v is number => v != null);

  const benchmarks: PartnerSelfBenchmarks = {
    winRate: buildBenchmark(metrics.winRate, values((m) => m.winRate), true),
    acceptRate: buildBenchmark(
      metrics.acceptRate,
      values((m) => m.acceptRate),
      true,
    ),
    medianResponseMs: buildBenchmark(
      metrics.medianResponseMs,
      values((m) => m.medianResponseMs),
      false,
    ),
    csat: buildBenchmark(metrics.csat, values((m) => m.csat), true),
  };

  const declines: PartnerDeclineBreakdown[] = declineRows
    .filter(
      (r): r is { declineReason: DeclineReason; count: number } =>
        Object.hasOwn(DECLINE_REASON_LABELS, r.declineReason),
    )
    .map((r) => ({
      reason: r.declineReason,
      label: DECLINE_REASON_LABELS[r.declineReason],
      count: r.count,
    }));

  const submitted = outcomes?.submitted ?? 0;
  const lost = outcomes?.lost ?? 0;
  const decidedWon = outcomes?.won ?? 0;

  return {
    sinceDays,
    since: since.toISOString(),
    metrics,
    benchmarks,
    cohortSize: others.length,
    lossReasons: {
      declines,
      declinedTotal: declines.reduce((sum, d) => sum + d.count, 0),
      proposalsLost: lost,
      proposalsPending: Math.max(0, submitted - decidedWon - lost),
    },
  };
}
