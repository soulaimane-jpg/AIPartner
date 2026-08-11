"use server";

/**
 * Win/loss capture — the customer's structured "why" recorded against
 * every proposal in the shortlist when they pick a winner.
 *
 * Triggers a notification to *all* bidding partners with anonymised
 * aggregates once ≥ 3 deals' worth of data has accumulated (the
 * `partner.winloss-feed` workstream — S7). Here we only persist the
 * raw capture; the digest worker emits the anonymised feed later.
 *
 * The winning proposal records `WIN_LOSS:winner`; losers record
 * `WIN_LOSS:<reason1>,<reason2>` — same column shape keeps the
 * aggregator simple.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, tx } from "@/lib/db";
import { WIN_LOSS_REASONS } from "@/lib/schemas/decline-reasons";

const CaptureWinLossInput = z.object({
  briefId: z.string().min(1),
  winnerProposalId: z.string().min(1),
  /** Per-loser reasons keyed by proposal id. Empty array allowed. */
  loserReasons: z.array(
    z.object({
      proposalId: z.string().min(1),
      reasons: z.array(z.enum(WIN_LOSS_REASONS)).min(1).max(4),
      note: z.string().trim().max(1000).optional(),
    }),
  ),
});

export const captureWinLossAction = defineAction({
  name: "match.win-loss.capture",
  input: CaptureWinLossInput,
  permission: "proposal.pin-winner",
  rateLimit: { scope: "match.win-loss.capture", limit: 10, windowSec: 600 },
  handler: async ({ briefId, winnerProposalId, loserReasons }, ctx) => {
    // Caller must own the brief.
    const brief = await queryOne<{ id: string }>(
      'SELECT "id" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
      [briefId, ctx.user!.id],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Winner proposal → tag the parent match.
    const winnerProposal = await queryOne<{ matchId: string }>(
      'SELECT "matchId" FROM "Proposal" WHERE "id" = $1',
      [winnerProposalId],
    );
    if (!winnerProposal) {
      fail({ code: "NOT_FOUND", resource: "Proposal" });
    }

    // Resolve loser matchIds before entering the transaction.
    const loserMatches: { matchId: string; reasons: string[]; note: string | null }[] =
      [];
    for (const loser of loserReasons) {
      const p = await queryOne<{ matchId: string }>(
        'SELECT "matchId" FROM "Proposal" WHERE "id" = $1',
        [loser.proposalId],
      );
      if (!p) continue;
      loserMatches.push({
        matchId: p.matchId,
        reasons: loser.reasons,
        note: loser.note ?? null,
      });
    }

    await tx(async (client) => {
      await client.query(
        `UPDATE "Match" SET "winLossReasons" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
        [
          winnerProposal!.matchId,
          JSON.stringify({
            outcome: "won",
            capturedAt: new Date().toISOString(),
          }),
        ],
      );
      for (const loser of loserMatches) {
        await client.query(
          `UPDATE "Match" SET "winLossReasons" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
          [
            loser.matchId,
            JSON.stringify({
              outcome: "lost",
              reasons: loser.reasons,
              note: loser.note,
              capturedAt: new Date().toISOString(),
            }),
          ],
        );
      }
    });

    revalidatePath(`/briefs/${briefId}/proposals`);
    return { ok: true as const, captured: loserReasons.length + 1 };
  },
});
