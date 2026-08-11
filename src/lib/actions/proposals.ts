"use server";

/**
 * Proposal Server Actions — partners submit, customers select.
 *
 * Wrapped in `defineAction` for validation/RBAC/audit/rate-limit.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, exec, insertRow, updateRows, tx } from "@/lib/db";

// ─── Customer selects a winning proposal ──────────────────────────

const SelectProposalInput = z.object({
  briefId: z.string().min(1),
  proposalId: z.string().min(1),
});

export const selectProposalAction = defineAction({
  name: "proposal.select",
  input: SelectProposalInput,
  permission: "proposal.pin-winner",
  rateLimit: { scope: "proposal.select", limit: 20, windowSec: 60 },
  handler: async ({ briefId, proposalId }, ctx) => {
    const brief = await queryOne<{ id: string }>(
      'SELECT "id" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
      [briefId, ctx.user!.id],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    await tx(async (client) => {
      await client.query(
        `UPDATE "Proposal" SET "status" = 'DECLINED', "updatedAt" = NOW()
         WHERE "briefId" = $1`,
        [briefId],
      );
      await client.query(
        `UPDATE "Proposal" SET "status" = 'SELECTED', "updatedAt" = NOW()
         WHERE "id" = $1`,
        [proposalId],
      );
      await client.query(
        `UPDATE "ProjectBrief" SET "stage" = 'INTRODUCTION', "updatedAt" = NOW()
         WHERE "id" = $1`,
        [briefId],
      );
      await insertRow(
        "Notification",
        {
          userId: ctx.user!.id,
          type: "brief.partner_selected",
          title: "Partner selected",
          message:
            "We're facilitating the introduction to your selected partner.",
          link: `/briefs/${briefId}/preview`,
        },
        { client },
      );

      // Notify admins to set up the meeting.
      const admins = await client.query<{ id: string }>(
        `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
      );
      for (const a of admins.rows) {
        await insertRow(
          "Notification",
          {
            userId: a.id,
            type: "partners.selected",
            title: "Client selected a partner — schedule meeting",
            message: `The client selected a partner for "${briefId}". Set up an alignment meeting.`,
            link: `/admin/briefs/${briefId}`,
          },
          { client },
        );
      }
    });

    revalidatePath("/dashboard");
    revalidatePath(`/briefs/${briefId}/proposals`);
    return { ok: true as const };
  },
});

// ─── Partner submits / updates a proposal ────────────────────────

const SubmitProposalInput = z.object({
  briefId: z.string().min(1),
  summary: z.string().min(5),
  approach: z.string().min(5).optional(),
  timelineWeeks: z.coerce.number().int().positive(),
  /** Dollars — converted to cents on the server. */
  totalCost: z.coerce.number().int().nonnegative(),
  strengths: z.array(z.string()).default([]),
  team: z
    .array(
      z.object({
        role: z.string().min(1),
        seniority: z.string().optional(),
        count: z.coerce.number().int().positive().default(1),
      }),
    )
    .default([]),
});

export const submitPartnerProposalAction = defineAction({
  name: "proposal.submit",
  input: SubmitProposalInput,
  permission: "proposal.submit",
  rateLimit: { scope: "proposal.submit", limit: 10, windowSec: 60 },
  handler: async (parsed, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Partner company required" });
    }
    const { briefId } = parsed;
    const match = await queryOne<{ id: string; proposalId: string | null }>(
      `SELECT m."id", p."id" AS "proposalId"
       FROM "Match" m
       LEFT JOIN "Proposal" p ON p."matchId" = m."id"
       WHERE m."briefId" = $1 AND m."partnerId" = $2`,
      [briefId, ctx.user!.companyId!],
    );
    if (!match) {
      fail({
        code: "FORBIDDEN",
        reason: "This brief isn't assigned to your company.",
      });
    }

    const data = {
      summary: parsed.summary,
      approach: parsed.approach ?? null,
      timelineWeeks: parsed.timelineWeeks,
      totalCost: parsed.totalCost * 100,
      strengths: JSON.stringify(parsed.strengths),
      teamComposition: JSON.stringify(parsed.team),
      status: "SUBMITTED" as const,
      submittedAt: new Date(),
    };

    if (match!.proposalId) {
      await updateRows("Proposal", { id: match!.proposalId }, data);
    } else {
      await insertRow("Proposal", {
        briefId,
        partnerId: ctx.user!.companyId!,
        matchId: match!.id,
        ...data,
      });
    }

    await exec(
      `UPDATE "ProjectBrief" SET "stage" = 'PROPOSALS', "updatedAt" = NOW()
       WHERE "id" = $1 AND "stage" IN ('SOURCING', 'REVIEW')`,
      [briefId],
    );

    const brief = await queryOne<{ ownerId: string; title: string }>(
      'SELECT "ownerId", "title" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (brief) {
      await insertRow("Notification", {
        userId: brief.ownerId,
        type: "proposal.received",
        title: "New proposal received",
        message: `A proposal from ${ctx.user!.name ?? "a partner"} is ready to review.`,
        link: `/briefs/${briefId}/proposals`,
      });
    }

    revalidatePath("/partner");
    revalidatePath(`/partner/briefs/${briefId}`);
    revalidatePath(`/briefs/${briefId}/proposals`);
    return { ok: true as const };
  },
});
