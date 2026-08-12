"use server";

/**
 * Admin partner-vetting actions.
 *
 * A partner company is created `PENDING` and is invisible to sourcing
 * and invites until approved here. Approval is always an explicit,
 * audited human decision — the domain evidence surfaced in the review
 * queue is a signal, not a rule.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, updateRows } from "@/lib/db";
import { notifyCompanyUsers } from "@/lib/notify";
import { assessDomainEvidence } from "@/lib/partner-verification";

const PartnerIdInput = z.object({ partnerId: z.string().min(1) });

async function loadPartner(partnerId: string) {
  const partner = await queryOne<{
    id: string;
    name: string;
    kind: string;
    verificationStatus: string;
    signupEmailDomain: string | null;
    website: string | null;
    directoryUrl: string | null;
  }>(
    `SELECT c."id", c."name", c."kind", c."verificationStatus",
            c."signupEmailDomain", c."website", pp."directoryUrl"
     FROM "Company" c
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE c."id" = $1`,
    [partnerId],
  );
  if (!partner) fail({ code: "NOT_FOUND", resource: "Partner" });
  if (partner!.kind !== "PARTNER") {
    fail({ code: "CONFLICT", reason: "Company is not a partner" });
  }
  return partner!;
}

export const approvePartnerAction = defineAction({
  name: "admin.partner.approve",
  input: PartnerIdInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.approve", limit: 60, windowSec: 60 },
  handler: async ({ partnerId }, ctx) => {
    const partner = await loadPartner(partnerId);
    if (partner.verificationStatus === "APPROVED") {
      return { ok: true as const, alreadyApproved: true };
    }

    // Re-assess at decision time so the audit record reflects the
    // evidence as it stood when the admin approved.
    const evidence = partner.signupEmailDomain
      ? assessDomainEvidence({
          email: `noreply@${partner.signupEmailDomain}`,
          website: partner.website,
          directoryUrl: partner.directoryUrl,
        })
      : null;

    await updateRows(
      "Company",
      { id: partnerId },
      {
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        verifiedById: ctx.user?.id ?? null,
        rejectionReason: null,
        domainVerifiedAt: evidence?.matched ? new Date() : null,
      },
    );

    await notifyCompanyUsers(partnerId, {
      event: "partner.verification_approved",
      link: "/partner",
      vars: { partnerName: partner.name },
    });

    revalidatePath("/admin/partners");
    revalidatePath("/partner");
    return { ok: true as const, alreadyApproved: false };
  },
});

export const rejectPartnerAction = defineAction({
  name: "admin.partner.reject",
  input: PartnerIdInput.extend({
    reason: z.string().trim().min(5).max(500),
  }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.reject", limit: 60, windowSec: 60 },
  handler: async ({ partnerId, reason }, ctx) => {
    const partner = await loadPartner(partnerId);

    await updateRows(
      "Company",
      { id: partnerId },
      {
        verificationStatus: "REJECTED",
        verifiedAt: new Date(),
        verifiedById: ctx.user?.id ?? null,
        rejectionReason: reason,
      },
    );

    await notifyCompanyUsers(partnerId, {
      event: "partner.verification_rejected",
      link: "/partner/profile",
      vars: { partnerName: partner.name, reason },
    });

    revalidatePath("/admin/partners");
    revalidatePath("/partner");
    return { ok: true as const };
  },
});
