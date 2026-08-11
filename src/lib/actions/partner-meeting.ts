"use server";

/**
 * Partner-side meeting slot proposal.
 *
 * After a partner accepts a lead (status = PARTNER_ACCEPTED), they can
 * propose up to 3 meeting time slots for an alignment call with the
 * customer. The admin confirms one slot — mirroring the customer-side
 * flow where the customer proposes slots on the brief and the admin
 * confirms via `confirmMeetingSlotAction`.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, updateRows, insertRow } from "@/lib/db";

const PartnerMeetingSlot = z.object({
  startsAt: z.string().min(1).datetime({ offset: true }).or(z.string().min(1)),
  durationMins: z.coerce.number().int().min(15).max(240).default(30),
});

const ProposeMeetingInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1),
  proposedSlots: z
    .array(PartnerMeetingSlot)
    .min(1, "Propose at least one time slot")
    .max(3, "Propose up to three time slots"),
  agenda: z.string().trim().max(2000).optional(),
});

export const partnerProposeMeetingAction = defineAction({
  name: "partner.meeting.propose",
  input: ProposeMeetingInput,
  permission: "meeting.propose",
  rateLimit: { scope: "partner.meeting.propose", limit: 10, windowSec: 600 },
  handler: async ({ matchId, briefId, proposedSlots, agenda }, ctx) => {
    const match = await queryOne<{
      id: string;
      partnerId: string;
      briefId: string;
      status: string;
    }>(
      `SELECT "id", "partnerId", "briefId", "status"
       FROM "Match" WHERE "id" = $1`,
      [matchId],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    if (match!.partnerId !== ctx.user!.companyId) {
      fail({ code: "FORBIDDEN", reason: "This match isn't assigned to your company." });
    }

    if (match!.status !== "PARTNER_ACCEPTED" && match!.status !== "EXTENSION_REQUESTED") {
      fail({
        code: "CONFLICT",
        reason: "You can only propose meeting times after accepting the lead.",
      });
    }

    await updateRows(
      "Match",
      { id: matchId },
      {
        meetingProposedSlots: JSON.stringify(
          proposedSlots.map((s) => ({
            startsAt: s.startsAt,
            durationMins: s.durationMins ?? 30,
          })),
        ),
        meetingAgenda: agenda ?? null,
      },
    );

    const brief = await queryOne<{ title: string; ownerId: string }>(
      `SELECT "title", "ownerId" FROM "ProjectBrief" WHERE "id" = $1`,
      [briefId],
    );

    if (brief) {
      await insertRow("Notification", {
        userId: brief.ownerId,
        type: "partner.meeting_proposed",
        title: "Partner proposed meeting times",
        message: `A partner has proposed ${proposedSlots.length} time slot${proposedSlots.length > 1 ? "s" : ""} for an alignment call on "${brief.title}".`,
        link: `/briefs/${briefId}/preview`,
      });
    }

    const admins = await (await import("@/lib/db")).query<{ id: string }>(
      `SELECT "id" FROM "User" WHERE "role" = 'ADMIN'`,
    );
    for (const a of admins) {
      await insertRow("Notification", {
        userId: a.id,
        type: "partner.meeting_proposed",
        title: "Partner proposed meeting slots",
        message: `Partner proposed ${proposedSlots.length} meeting slot${proposedSlots.length > 1 ? "s" : ""} for "${brief?.title ?? "a brief"}". Confirm one to schedule the alignment call.`,
        link: `/admin/briefs/${briefId}`,
      });
    }

    revalidatePath(`/partner/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});
