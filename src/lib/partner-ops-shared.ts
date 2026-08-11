/**
 * Isomorphic types + formatters for the partner-ops dashboard.
 * Split out so client components don't pull the server-only DB code
 * via the import graph.
 */

export interface PartnerOpsRow {
  partnerId: string;
  partnerName: string;
  tier: string | null;
  medianResponseMs: number | null;
  acceptRate: number | null;
  winRate: number | null;
  csat: number | null;
  totalMatches: number;
}

/** Human-friendly duration formatter for response times. */
export function formatResponseMs(ms: number | null): string {
  if (ms == null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
