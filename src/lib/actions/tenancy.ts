import "server-only";

import { query, queryOne } from "@/lib/db";
// Imported from the schema module rather than `./define` so this stays
// free of the auth/session import chain and remains unit-testable.
import { fail } from "@/lib/schemas/errors";

/**
 * Re-scoping helpers for compound payloads.
 *
 * The bug class these exist to kill: an action authorizes the caller
 * against ONE id from the payload (usually `briefId`) and then resolves
 * the payload's *other* ids by primary key alone. The authorization
 * check passes, and the write lands on a row belonging to a different
 * tenant.
 *
 * Two real instances were shipped — `captureWinLossAction` and
 * `selectProposalAction` — both of which verified brief ownership and
 * then did `... FROM "Proposal" WHERE "id" = $1` with no `briefId`.
 *
 * Rule: every id in a payload must be re-scoped to the parent the
 * caller was actually authorized against. Never trust a sibling id
 * just because its neighbour checked out.
 */

/**
 * Resolve a proposal, asserting it belongs to `briefId`.
 *
 * Fails NOT_FOUND (never FORBIDDEN) on a cross-tenant id: telling the
 * caller "that exists but isn't yours" confirms the id is real.
 */
export async function requireProposalInBrief(
  proposalId: string,
  briefId: string,
): Promise<{ id: string; matchId: string; partnerId: string; status: string }> {
  const row = await queryOne<{
    id: string;
    matchId: string;
    partnerId: string;
    status: string;
  }>(
    `SELECT "id", "matchId", "partnerId", "status"
       FROM "Proposal"
      WHERE "id" = $1 AND "briefId" = $2`,
    [proposalId, briefId],
  );
  if (!row) fail({ code: "NOT_FOUND", resource: "Proposal" });
  return row!;
}

/**
 * Batch form of `requireProposalInBrief`.
 *
 * Fails if ANY id is missing or foreign — deliberately all-or-nothing.
 * The vulnerable original skipped unresolvable ids with `continue`,
 * which is what made the cross-tenant write silent.
 */
export async function requireProposalsInBrief(
  proposalIds: string[],
  briefId: string,
): Promise<Map<string, { id: string; matchId: string; partnerId: string }>> {
  if (proposalIds.length === 0) return new Map();

  const rows = await query<{ id: string; matchId: string; partnerId: string }>(
    `SELECT "id", "matchId", "partnerId"
       FROM "Proposal"
      WHERE "id" = ANY($1) AND "briefId" = $2`,
    [proposalIds, briefId],
  );

  const found = new Map(rows.map((r) => [r.id, r]));
  const missing = proposalIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    fail({
      code: "NOT_FOUND",
      resource: `Proposal (${missing.length} not on this brief)`,
    });
  }
  return found;
}

/**
 * Batch form of `requireMatchInBrief`. All-or-nothing.
 */
export async function requireMatchesInBrief(
  matchIds: string[],
  briefId: string,
): Promise<Map<string, { id: string; partnerId: string; status: string }>> {
  if (matchIds.length === 0) return new Map();

  const rows = await query<{ id: string; partnerId: string; status: string }>(
    `SELECT "id", "partnerId", "status"
       FROM "Match"
      WHERE "id" = ANY($1) AND "briefId" = $2`,
    [matchIds, briefId],
  );

  const found = new Map(rows.map((r) => [r.id, r]));
  const missing = matchIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    fail({
      code: "NOT_FOUND",
      resource: `Match (${missing.length} not on this brief)`,
    });
  }
  return found;
}

/** Resolve a match, asserting it belongs to `briefId`. */
export async function requireMatchInBrief(
  matchId: string,
  briefId: string,
): Promise<{ id: string; partnerId: string; status: string }> {
  const row = await queryOne<{ id: string; partnerId: string; status: string }>(
    `SELECT "id", "partnerId", "status"
       FROM "Match"
      WHERE "id" = $1 AND "briefId" = $2`,
    [matchId, briefId],
  );
  if (!row) fail({ code: "NOT_FOUND", resource: "Match" });
  return row!;
}
