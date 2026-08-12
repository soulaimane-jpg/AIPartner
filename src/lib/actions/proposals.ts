"use server";

/**
 * Proposal Server Actions — customer selection.
 *
 * Partner submission lives in `proposal-builder.ts` (structured,
 * section-based, deadline- and state-machine-aware). The unstructured
 * `submitPartnerProposalAction` that used to live here was removed:
 * it had no UI, skipped the T2 deadline check and the proposal state
 * machine, and would silently overwrite an already-submitted proposal.
 *
 * Wrapped in `defineAction` for validation/RBAC/audit/rate-limit.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, tx } from "@/lib/db";
import { advanceLeadIfAllowed } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { notify, notifyAdmins } from "@/lib/notify";

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
    const brief = await queryOne<{ id: string; title: string }>(
      'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
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
    });

    // Notifications live outside the transaction on purpose: they
    // enqueue email, and a mail hiccup must not roll back a selection
    // the customer has already made.
    await notify({
      event: "brief.partner_selected",
      recipients: [{ userId: ctx.user!.id }],
      vars: { briefTitle: brief!.title },
      link: `/briefs/${briefId}/preview`,
      briefId,
      idemKey: `partner-selected:${proposalId}`,
    });
    await notifyAdmins({
      event: "selection.partners_selected_admin",
      vars: { briefTitle: brief!.title, partnerNames: "1 partner" },
      link: `/admin/briefs/${briefId}`,
      briefId,
      idemKey: `selected-admin:${proposalId}`,
    });

    // Selection is NOT the reveal. This action used to write
    // stage='INTRODUCTION', which for briefs whose `leadState` was
    // still the default DRAFT inferred REVEAL_APPROVED — auto-revealing
    // partner identity without the separate, consented reveal step
    // (§8 layer 3). The lead stops at COMPANY_SELECTED; the customer
    // still has to approve the reveal explicitly.
    await advanceLeadIfAllowed({
      briefId,
      to: "COMPANY_SELECTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      meta: { via: "proposal.select", proposalId },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/briefs/${briefId}/proposals`);
    return { ok: true as const };
  },
});
