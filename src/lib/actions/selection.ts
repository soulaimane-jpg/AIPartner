"use server";

/**
 * M10 — comparison, team voting, selection, reveal (plan-A §6 M10).
 *
 *   - Team members vote yes/no per anonymized column ("Partner A").
 *   - The brief owner selects 1–3 partners inside the selection
 *     window (company_select timer).
 *   - Selection and reveal are TWO distinct actions (M10.6): identity
 *     flows only after the explicit reveal consent, and only for
 *     selected partners. Not-selected partners stay anonymous forever
 *     and receive the respectful decline.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow } from "@/lib/db";
import { transitionInvite } from "@/lib/state-machine/invite";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { satisfyTimer } from "@/lib/timers";
import { notify } from "@/lib/notify";

// ─── Team voting ──────────────────────────────────────────────

const VoteInput = z.object({
  briefId: z.string().min(1),
  matchId: z.string().min(1),
  value: z.enum(["yes", "no"]),
  comment: z.string().max(2000).optional(),
});

export const castProposalVoteAction = defineAction({
  name: "vote.cast",
  input: VoteInput,
  permission: "vote.cast",
  rateLimit: { scope: "vote.cast", limit: 60, windowSec: 60 },
  handler: async ({ briefId, matchId, value, comment }, ctx) => {
    await insertRow(
      "ProposalVote",
      {
        briefId,
        matchId,
        userId: ctx.user!.id,
        value,
        comment: comment ?? null,
      },
      {
        onConflict: `("matchId", "userId") DO UPDATE SET
          "value" = EXCLUDED."value",
          "comment" = EXCLUDED."comment",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );
    revalidatePath(`/briefs/${briefId}/compare`);
    return { ok: true as const };
  },
});

// ─── Selection (1–3 partners) ─────────────────────────────────

const SelectPartnersInput = z.object({
  briefId: z.string().min(1),
  matchIds: z.array(z.string().min(1)).min(1).max(3),
});

export const selectPartnersAction = defineAction({
  name: "selection.select",
  input: SelectPartnersInput,
  permission: "selection.select",
  rateLimit: { scope: "selection.select", limit: 10, windowSec: 60 },
  handler: async ({ briefId, matchIds }, ctx) => {
    const state = await getLeadState(briefId);
    if (state !== "COMPARISON_RELEASED") {
      fail({
        code: "CONFLICT",
        reason: `Selection requires COMPARISON_RELEASED (is ${state})`,
      });
    }

    // Only QC-passed, released columns are selectable.
    const candidates = await query<{ id: string }>(
      `SELECT "id" FROM "Match" WHERE "briefId" = $1 AND "status" = 'QC_PASSED'`,
      [briefId],
    );
    const candidateIds = new Set(candidates.map((m) => m.id));
    for (const id of matchIds) {
      if (!candidateIds.has(id)) {
        fail({ code: "CONFLICT", reason: "One of the selections is not eligible" });
      }
    }

    const actor = userActor(ctx.user!.id, ctx.user!.companyId);
    for (const match of candidates) {
      await transitionInvite({
        matchId: match.id,
        to: matchIds.includes(match.id) ? "SELECTED" : "NOT_SELECTED",
        actor,
      });
    }

    // Legacy proposal status for selected partners (read paths).
    await exec(
      `UPDATE "Proposal" SET "status" = 'SELECTED', "updatedAt" = NOW()
       WHERE "briefId" = $1 AND "matchId" = ANY($2)`,
      [briefId, matchIds],
    );
    await exec(
      `UPDATE "Proposal" SET "status" = 'DECLINED', "updatedAt" = NOW()
       WHERE "briefId" = $1 AND NOT ("matchId" = ANY($2)) AND "status" = 'QC_PASSED'`,
      [briefId, matchIds],
    );

    await satisfyTimer("brief", briefId, "company_select");
    await transitionLead({
      briefId,
      to: "COMPANY_SELECTED",
      actor,
      meta: { selected: matchIds.length },
    });

    // Notify admins to set up meetings with the selected partner(s).
    const brief = await queryOne<{ title: string }>(
      'SELECT "title" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    const selectedPartners = await query<{ name: string }>(
      `SELECT c."name" FROM "Match" m
       JOIN "Company" c ON c."id" = m."partnerId"
       WHERE m."id" = ANY($1)`,
      [matchIds],
    );
    const admins = await query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
    );
    for (const a of admins) {
      await insertRow("Notification", {
        userId: a.id,
        type: "partners.selected",
        title: "Client selected partner(s) — schedule meetings",
        message: `The client selected ${selectedPartners.length} partner${selectedPartners.length > 1 ? "s" : ""} for "${brief?.title ?? "a brief"}": ${selectedPartners.map((p) => p.name).join(", ")}. Set up alignment meetings.`,
        link: `/admin/briefs/${briefId}`,
      });
    }

    revalidatePath(`/briefs/${briefId}/compare`);
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});

// ─── Reveal consent (distinct second action, M10.6) ───────────

const RevealInput = z.object({ briefId: z.string().min(1) });

export const approveRevealAction = defineAction({
  name: "selection.reveal",
  input: RevealInput,
  permission: "selection.reveal",
  rateLimit: { scope: "selection.reveal", limit: 10, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    const state = await getLeadState(briefId);
    if (state !== "COMPANY_SELECTED") {
      fail({
        code: "CONFLICT",
        reason: `Reveal requires COMPANY_SELECTED (is ${state})`,
      });
    }

    const brief = await queryOne<{ id: string; title: string }>(
      'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    await transitionLead({
      briefId,
      to: "REVEAL_APPROVED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      reason: "Customer approved mutual identity reveal",
    });

    // M11.1 — notify both sides now that the reveal event happened.
    const matches = await query<{
      id: string;
      status: string;
      partnerId: string;
    }>(
      `SELECT "id", "status", "partnerId" FROM "Match"
       WHERE "briefId" = $1 AND "status" IN ('SELECTED', 'NOT_SELECTED')`,
      [briefId],
    );
    for (const match of matches) {
      const partnerUsers = await query<{ id: string }>(
        'SELECT "id" FROM "User" WHERE "companyId" = $1',
        [match.partnerId],
      );
      await notify({
        event:
          match.status === "SELECTED" ? "partner.selected" : "partner.not_selected",
        recipients: partnerUsers.map((u) => ({ userId: u.id })),
        vars: { briefTitle: brief!.title },
        link:
          match.status === "SELECTED"
            ? `/partner/briefs/${briefId}`
            : undefined,
        briefId,
        matchId: match.id,
        idemKey: `reveal:${match.id}`,
      });
    }

    revalidatePath(`/briefs/${briefId}/compare`);
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});
