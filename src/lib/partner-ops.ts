/**
 * Partner-ops metrics for the admin dashboard.
 *
 * Computes — per partner company:
 *   - **Response time**: median ms between `outreachSentAt` and either
 *     `acceptedTermsAt` (accepted) or `updatedAt` on a declined match.
 *   - **Accept rate**: accepted / (accepted + declined) over the window.
 *   - **Win rate**: matches set to `IN_FINAL_THREE` then progressed to
 *     a winning `Proposal` (`status = "SELECTED"`).
 *   - **CSAT**: avg NPS score for engagements involving the partner
 *     (best-effort: surface = "partner.engagement" with the partner's
 *     brief join). Falls back to null when n < 3.
 *
 * Designed as a single table scan per metric → cheap to render every
 * admin page load. The window defaults to the trailing 90 days but
 * callers can override.
 */

import "server-only";
import { query } from "@/lib/db";
import type { PartnerOpsRow } from "@/lib/partner-ops-shared";

export type { PartnerOpsRow } from "@/lib/partner-ops-shared";
export { formatResponseMs } from "@/lib/partner-ops-shared";

export interface PartnerOpsOptions {
  /** Defaults to the trailing 90 days. */
  sinceDays?: number;
}

function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function listPartnerOps(
  options: PartnerOpsOptions = {},
): Promise<PartnerOpsRow[]> {
  const since = new Date(
    Date.now() - (options.sinceDays ?? 90) * 86_400_000,
  );

  const [partners, matches, proposals] = await Promise.all([
    query<{ id: string; name: string; tier: string | null }>(
      `SELECT c."id", c."name", pp."tier"
       FROM "Company" c
       LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
       WHERE c."kind" = 'PARTNER'`,
    ),
    query<{
      partnerId: string;
      status: string;
      outreachSentAt: Date | null;
      acceptedTermsAt: Date | null;
      updatedAt: Date;
    }>(
      `SELECT "partnerId", "status", "outreachSentAt", "acceptedTermsAt", "updatedAt"
       FROM "Match" WHERE "createdAt" >= $1`,
      [since],
    ),
    query<{ partnerId: string; status: string }>(
      'SELECT "partnerId", "status" FROM "Proposal" WHERE "submittedAt" >= $1',
      [since],
    ),
  ]);

  // Group matches by partner.
  const matchesByPartner = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = matchesByPartner.get(m.partnerId) ?? [];
    arr.push(m);
    matchesByPartner.set(m.partnerId, arr);
  }
  const proposalsByPartner = new Map<string, typeof proposals>();
  for (const p of proposals) {
    const arr = proposalsByPartner.get(p.partnerId) ?? [];
    arr.push(p);
    proposalsByPartner.set(p.partnerId, arr);
  }

  // CSAT — partner.engagement NPS rows joined via brief → match → partner.
  // Cheap implementation: scan responses, attribute to partners via
  // their accepted matches in the same brief.
  const npsRows = await query<{ score: number; briefId: string | null }>(
    `SELECT "score", "briefId" FROM "NpsResponse"
     WHERE "surface" = 'partner.engagement' AND "createdAt" >= $1`,
    [since],
  );
  const npsByPartner = new Map<string, number[]>();
  if (npsRows.length > 0) {
    const briefIds = npsRows
      .map((n) => n.briefId)
      .filter((b): b is string => !!b);
    const accepted = await query<{ briefId: string; partnerId: string }>(
      `SELECT "briefId", "partnerId" FROM "Match"
       WHERE "briefId" = ANY($1) AND "acceptedTermsAt" IS NOT NULL`,
      [briefIds],
    );
    const partnersByBrief = new Map<string, string[]>();
    for (const a of accepted) {
      const arr = partnersByBrief.get(a.briefId) ?? [];
      arr.push(a.partnerId);
      partnersByBrief.set(a.briefId, arr);
    }
    for (const n of npsRows) {
      if (!n.briefId) continue;
      const ps = partnersByBrief.get(n.briefId) ?? [];
      for (const pid of ps) {
        const arr = npsByPartner.get(pid) ?? [];
        arr.push(n.score);
        npsByPartner.set(pid, arr);
      }
    }
  }

  return partners
    .map<PartnerOpsRow>((p) => {
      const pm = matchesByPartner.get(p.id) ?? [];
      const responseTimes: number[] = [];
      let accepted = 0;
      let declined = 0;
      for (const m of pm) {
        const sentAt = m.outreachSentAt;
        if (!sentAt) continue;
        if (m.acceptedTermsAt) {
          responseTimes.push(
            m.acceptedTermsAt.getTime() - sentAt.getTime(),
          );
          accepted++;
        } else if (m.status === "PARTNER_DECLINED") {
          responseTimes.push(m.updatedAt.getTime() - sentAt.getTime());
          declined++;
        }
      }
      const acceptable = accepted + declined;
      const pp = proposalsByPartner.get(p.id) ?? [];
      const submitted = pp.length;
      const won = pp.filter((x) => x.status === "SELECTED").length;
      const npsList = npsByPartner.get(p.id) ?? [];
      const csat =
        npsList.length >= 3
          ? Math.round(
              (npsList.reduce((a, b) => a + b, 0) / npsList.length) * 10,
            ) / 10
          : null;

      return {
        partnerId: p.id,
        partnerName: p.name,
        tier: p.tier ?? null,
        medianResponseMs: median(responseTimes),
        acceptRate: acceptable > 0 ? accepted / acceptable : null,
        winRate: submitted > 0 ? won / submitted : null,
        csat,
        totalMatches: pm.length,
      };
    })
    .sort((a, b) => b.totalMatches - a.totalMatches);
}

