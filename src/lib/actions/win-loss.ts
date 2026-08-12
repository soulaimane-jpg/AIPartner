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
import {
  requireProposalInBrief,
  requireProposalsInBrief,
} from "@/lib/actions/tenancy";
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

    // Every proposal id must be re-scoped to the brief the caller was
    // authorized against. Owning brief A previously let a caller pass
    // proposal ids from brief B and write verdicts onto another
    // company's matches — the ownership check above passed, and the
    // `WHERE "id" = $1` lookups never mentioned the brief.
    const winnerProposal = await requireProposalInBrief(
      winnerProposalId,
      briefId,
    );

    const loserIds = loserReasons.map((l) => l.proposalId);
    if (loserIds.includes(winnerProposalId)) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "loserReasons",
            message: "The winning proposal cannot also be recorded as a loss.",
          },
        ],
      });
    }
    // All-or-nothing: the original skipped unresolvable ids with
    // `continue`, which is exactly what made the cross-tenant write
    // silent.
    const loserProposals = await requireProposalsInBrief(loserIds, briefId);

    const loserMatches = loserReasons.map((loser) => ({
      matchId: loserProposals.get(loser.proposalId)!.matchId,
      reasons: loser.reasons,
      note: loser.note ?? null,
    }));

    await tx(async (client) => {
      await client.query(
        `UPDATE "Match" SET "winLossReasons" = $2, "updatedAt" = NOW() WHERE "id" = $1`,
        [
          winnerProposal.matchId,
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
