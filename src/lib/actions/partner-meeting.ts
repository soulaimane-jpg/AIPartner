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
import { queryOne, updateRows } from "@/lib/db";
import { notify, notifyAdmins } from "@/lib/notify";

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
      await notify({
        event: "meeting.proposed",
        recipients: [{ userId: brief.ownerId }],
        vars: { briefTitle: brief.title },
        link: `/briefs/${briefId}/preview`,
        briefId,
      });
    }

    await notifyAdmins({
      event: "meeting.proposed",
      vars: { briefTitle: brief?.title ?? "a brief" },
      link: `/admin/briefs/${briefId}`,
      briefId,
    });

    revalidatePath(`/partner/briefs/${briefId}`);
    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});
