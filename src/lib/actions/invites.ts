"use server";

/**
 * M6 — partner lead flow (plan-A §6 M6, §5.2, §7).
 *
 *   admin selects partners → invites sent (T1 starts) →
 *   partner accepts (T1 satisfied, T2 starts) →
 *   [optional one-time extension] → proposal submitted (WS8)
 *
 * Discipline:
 *   - Every status write goes through the invite state machine.
 *   - Every deadline is a `TimerInstance` — reminders + expiry run in
 *     the cron sweep, durations come from PlatformSettings.
 *   - Partners see the anonymized company summary only (§8).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow } from "@/lib/db";
import type { MatchRow } from "@/lib/db/rows";
import { transitionInvite } from "@/lib/state-machine/invite";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { getSetting } from "@/lib/settings";
import { startTimer, satisfyTimer, extendTimer, cancelTimer } from "@/lib/timers";
import { notify, notifyAdmins } from "@/lib/notify";

/** Match + firewall-safe display labels used by several handlers. */
async function loadMatchWithLabels(matchId: string) {
  return queryOne<MatchRow & { briefTitle: string; partnerName: string }>(
    `SELECT m.*, b."title" AS "briefTitle", c."name" AS "partnerName"
     FROM "Match" m
     JOIN "ProjectBrief" b ON b."id" = m."briefId"
     JOIN "Company" c ON c."id" = m."partnerId"
     WHERE m."id" = $1`,
    [matchId],
  );
}

// ─── 1. Admin selects partners ────────────────────────────────

const SelectPartnersInput = z.object({
  briefId: z.string().min(1),
  partnerIds: z.array(z.string().min(1)).min(1).max(10),
});

export const adminSelectPartnersAction = defineAction({
  name: "admin.invites.select-partners",
  input: SelectPartnersInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.invites.select", limit: 30, windowSec: 60 },
  handler: async ({ briefId, partnerIds }, ctx) => {
    const state = await getLeadState(briefId);
    if (state !== "LEAD_APPROVED" && state !== "STALLED") {
      fail({
        code: "CONFLICT",
        reason: `Lead must be LEAD_APPROVED or STALLED (is ${state})`,
      });
    }

    // Vetting gate: an unapproved partner must never reach a customer,
    // regardless of how the admin arrived at this list.
    const approved = await query<{ id: string }>(
      `SELECT "id" FROM "Company"
       WHERE "id" = ANY($1) AND "kind" = 'PARTNER' AND "verificationStatus" = 'APPROVED'`,
      [partnerIds],
    );
    if (approved.length !== partnerIds.length) {
      const approvedIds = new Set(approved.map((c) => c.id));
      const blocked = partnerIds.filter((id) => !approvedIds.has(id));
      fail({
        code: "CONFLICT",
        reason: `${blocked.length} selected partner(s) are not verified. Approve them in Partner verification before inviting.`,
      });
    }

    // Stable placeholder labels: continue the alphabet across
    // re-selections so labels never collide or get reused.
    const existing = await query<{
      partnerId: string;
      placeholderLabel: string | null;
    }>(
      'SELECT "partnerId", "placeholderLabel" FROM "Match" WHERE "briefId" = $1',
      [briefId],
    );
    const usedLabels = new Set(
      existing.map((m) => m.placeholderLabel).filter(Boolean),
    );
    let labelIndex = 0;
    const nextLabel = () => {
      while (usedLabels.has(`Partner ${String.fromCharCode(65 + labelIndex)}`)) {
        labelIndex++;
      }
      const label = `Partner ${String.fromCharCode(65 + labelIndex)}`;
      usedLabels.add(label);
      return label;
    };

    const existingByPartner = new Map(existing.map((m) => [m.partnerId, m]));
    for (const partnerId of partnerIds) {
      const prior = existingByPartner.get(partnerId);
      if (prior) {
        if (!prior.placeholderLabel) {
          await queryOne(
            `UPDATE "Match" SET "placeholderLabel" = $3, "updatedAt" = NOW()
             WHERE "briefId" = $1 AND "partnerId" = $2`,
            [briefId, partnerId, nextLabel()],
          );
        }
      } else {
        await insertRow(
          "Match",
          {
            briefId,
            partnerId,
            status: "SOURCED",
            placeholderLabel: nextLabel(),
          },
          { onConflict: '("briefId", "partnerId") DO NOTHING' },
        );
      }
    }

    await transitionLead({
      briefId,
      to: "PARTNERS_SELECTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      meta: { partnerIds },
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    return { ok: true as const };
  },
});

// ─── 2. Send invites (T1 starts) ──────────────────────────────

const SendInvitesInput = z.object({
  briefId: z.string().min(1),
  /** Optional per-lead T2 override (admin sets at invite time, §7). */
  proposalHoursOverride: z.coerce.number().int().min(4).max(336).optional(),
});

export const adminSendInvitesAction = defineAction({
  name: "admin.invites.send",
  input: SendInvitesInput,
  output: z.object({ invited: z.number() }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.invites.send", limit: 30, windowSec: 60 },
  handler: async ({ briefId, proposalHoursOverride }, ctx) => {
    const state = await getLeadState(briefId);
    if (state !== "PARTNERS_SELECTED") {
      fail({ code: "CONFLICT", reason: `Lead must be PARTNERS_SELECTED (is ${state})` });
    }

    const brief = await queryOne<{
      id: string;
      title: string;
      anonymizedCompanySummary: string | null;
    }>(
      'SELECT "id", "title", "anonymizedCompanySummary" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });
    if (!brief!.anonymizedCompanySummary) {
      fail({
        code: "CONFLICT",
        reason: "Anonymized company summary missing — approve the lead first",
      });
    }

    const acceptHours = await getSetting("lead_accept_hours");
    const acceptDeadline = new Date(Date.now() + acceptHours * 3_600_000);

    const matches = await query<{ id: string; partnerId: string }>(
      `SELECT "id", "partnerId" FROM "Match"
       WHERE "briefId" = $1 AND "status" = 'SOURCED'`,
      [briefId],
    );
    if (matches.length === 0) {
      fail({ code: "CONFLICT", reason: "No selected partners to invite" });
    }

    for (const match of matches) {
      await transitionInvite({
        matchId: match.id,
        to: "INVITED",
        actor: userActor(ctx.user!.id, ctx.user!.companyId),
        data: {
          acceptDeadlineAt: acceptDeadline,
          outreachSentAt: new Date(),
          ...(proposalHoursOverride
            ? { extensionNote: null } // no-op placeholder keeps data clean
            : {}),
        },
        meta: { acceptHours, proposalHoursOverride: proposalHoursOverride ?? null },
      });

      await startTimer({
        entityType: "match",
        entityId: match.id,
        timerType: "lead_accept",
        deadlineAt: acceptDeadline,
        meta: {
          briefId,
          matchId: match.id,
          proposalHoursOverride: proposalHoursOverride ?? null,
        },
      });

      // Lead routing: primary contact email + partner portal users.
      const partnerUsers = await query<{ id: string }>(
        'SELECT "id" FROM "User" WHERE "companyId" = $1',
        [match.partnerId],
      );
      const primary = await queryOne<{ email: string }>(
        `SELECT pc."email" FROM "PartnerContact" pc
         JOIN "PartnerProfile" pp ON pp."id" = pc."profileId"
         WHERE pp."companyId" = $1 AND pc."isPrimary" = TRUE
         LIMIT 1`,
        [match.partnerId],
      );
      const primaryEmail = primary?.email ?? null;
      await notify({
        event: "invite.sent",
        recipients: [
          ...partnerUsers.map((u) => ({ userId: u.id })),
          ...(primaryEmail ? [{ email: primaryEmail }] : []),
        ],
        vars: {
          briefTitle: brief!.title,
          anonymizedSummary: brief!.anonymizedCompanySummary!,
          acceptHours: String(acceptHours),
        },
        link: `/partner/briefs/${briefId}`,
        briefId,
        matchId: match.id,
        idemKey: `invite:${match.id}`,
      });
    }

    // The lead is at SENT_TO_PARTNERS until a proposal actually
    // arrives. Forcing stage='PROPOSALS' here (as this action used to)
    // contradicted the transition on the line above and left the
    // customer pipeline widget and the admin state gate disagreeing.
    await transitionLead({
      briefId,
      to: "SENT_TO_PARTNERS",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      meta: { invited: matches.length },
    });

    revalidatePath(`/admin/briefs/${briefId}`);
    return { invited: matches.length };
  },
});

// ─── 3. Partner accepts (T1 satisfied, T2 starts) ─────────────

const AcceptInviteInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1), // for RBAC condition
});

export const partnerAcceptInviteAction = defineAction({
  name: "invite.accept",
  input: AcceptInviteInput,
  permission: "match.accept",
  rateLimit: { scope: "invite.accept", limit: 30, windowSec: 60 },
  handler: async ({ matchId }, ctx) => {
    const match = await loadMatchWithLabels(matchId);
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    // Deadline guard — accepting after T1 has expired is a race the
    // sweep may not have caught yet.
    if (match!.acceptDeadlineAt && match!.acceptDeadlineAt < new Date()) {
      fail({ code: "CONFLICT", reason: "The acceptance window has passed" });
    }

    const timer = await queryOne<{ meta: string | null }>(
      `SELECT "meta" FROM "TimerInstance"
       WHERE "entityType" = 'match' AND "entityId" = $1
         AND "timerType" = 'lead_accept' AND "status" = 'active'
       LIMIT 1`,
      [matchId],
    );
    let proposalHours = await getSetting("proposal_submit_hours");
    try {
      const meta = JSON.parse(timer?.meta ?? "{}") as {
        proposalHoursOverride?: number | null;
      };
      if (meta.proposalHoursOverride) proposalHours = meta.proposalHoursOverride;
    } catch {
      /* default stands */
    }
    const proposalDeadline = new Date(Date.now() + proposalHours * 3_600_000);

    await transitionInvite({
      matchId,
      to: "PARTNER_ACCEPTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      data: {
        acceptedTermsAt: new Date(),
        proposalDeadlineAt: proposalDeadline,
      },
    });

    await satisfyTimer("match", matchId, "lead_accept");
    await startTimer({
      entityType: "match",
      entityId: matchId,
      timerType: "proposal_submit",
      deadlineAt: proposalDeadline,
      meta: { briefId: match!.briefId, matchId },
    });

    await notifyAdmins({
      event: "clarification.new_message",
      vars: {
        briefTitle: match!.briefTitle,
        fromLabel: match!.partnerName,
        preview: `Accepted the lead — proposal due ${proposalDeadline.toLocaleString()}.`,
      },
      link: `/admin/briefs/${match!.briefId}`,
      briefId: match!.briefId,
      matchId,
      idemKey: `accepted:${matchId}`,
    });

    revalidatePath(`/partner/briefs/${match!.briefId}`);
    revalidatePath("/partner");
    return { ok: true as const, proposalDeadline: proposalDeadline.toISOString() };
  },
});

// ─── 4. Partner declines (reason captured) ────────────────────

const DeclineInviteInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1),
  reason: z.string().min(3).max(2000),
});

export const partnerDeclineInviteAction = defineAction({
  name: "invite.decline",
  input: DeclineInviteInput,
  permission: "match.decline",
  rateLimit: { scope: "invite.decline", limit: 30, windowSec: 60 },
  handler: async ({ matchId, reason }, ctx) => {
    const match = await loadMatchWithLabels(matchId);
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });

    await transitionInvite({
      matchId,
      to: "PARTNER_DECLINED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      reason,
      data: { declineReason: reason },
    });
    await cancelTimer("match", matchId, "lead_accept");

    await notifyAdmins({
      event: "invite.expired_admin", // reuse: admin should consider a replacement
      vars: {
        briefTitle: match!.briefTitle,
        partnerName: `${match!.partnerName} (declined: ${reason.slice(0, 140)})`,
      },
      link: `/admin/briefs/${match!.briefId}`,
      briefId: match!.briefId,
      matchId,
      idemKey: `declined:${matchId}`,
    });

    revalidatePath(`/partner/briefs/${match!.briefId}`);
    revalidatePath("/partner");
    return { ok: true as const };
  },
});

// ─── 5. Extension request (one-time, hard rule) ───────────────

const RequestExtensionInput = z.object({
  matchId: z.string().min(1),
  briefId: z.string().min(1),
  /** Current-status note — required so admins can judge (P1 nicety, cheap). */
  note: z.string().min(3).max(2000),
});

export const partnerRequestExtensionAction = defineAction({
  name: "extension.request",
  input: RequestExtensionInput,
  permission: "extension.request",
  rateLimit: { scope: "extension.request", limit: 10, windowSec: 300 },
  handler: async ({ matchId, note }, ctx) => {
    const match = await loadMatchWithLabels(matchId);
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
    if (match!.extensionUsed) {
      fail({ code: "CONFLICT", reason: "The one-time extension was already used" });
    }

    await transitionInvite({
      matchId,
      to: "EXTENSION_REQUESTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      data: { extensionRequestedAt: new Date(), extensionNote: note },
    });

    await notifyAdmins({
      event: "extension.requested",
      vars: {
        briefTitle: match!.briefTitle,
        partnerName: match!.partnerName,
        note,
      },
      link: `/admin/briefs/${match!.briefId}`,
      briefId: match!.briefId,
      matchId,
      idemKey: `ext-req:${matchId}`,
    });

    revalidatePath(`/partner/briefs/${match!.briefId}`);
    return { ok: true as const };
  },
});

// ─── 6. Admin resolves extension ──────────────────────────────

const ResolveExtensionInput = z.object({
  matchId: z.string().min(1),
  grant: z.boolean(),
});

export const adminResolveExtensionAction = defineAction({
  name: "extension.resolve",
  input: ResolveExtensionInput,
  permission: "extension.resolve",
  rateLimit: { scope: "extension.resolve", limit: 30, windowSec: 60 },
  handler: async ({ matchId, grant }, ctx) => {
    const match = await loadMatchWithLabels(matchId);
    if (!match) fail({ code: "NOT_FOUND", resource: "Match" });
    if (match!.status !== "EXTENSION_REQUESTED") {
      fail({ code: "CONFLICT", reason: "No pending extension request" });
    }

    const extensionHours = await getSetting("extension_hours");
    let newDeadline: Date | null = null;

    if (grant) {
      newDeadline = await extendTimer(
        "match",
        matchId,
        "proposal_submit",
        extensionHours,
      );
      // Timer may have been created before the extension — fall back to
      // extending the stored column deadline.
      if (!newDeadline && match!.proposalDeadlineAt) {
        newDeadline = new Date(
          match!.proposalDeadlineAt.getTime() + extensionHours * 3_600_000,
        );
        await startTimer({
          entityType: "match",
          entityId: matchId,
          timerType: "proposal_submit",
          deadlineAt: newDeadline,
          meta: { briefId: match!.briefId, matchId },
        });
      }
    }

    await transitionInvite({
      matchId,
      to: "PARTNER_ACCEPTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      reason: grant ? "extension granted" : "extension denied",
      data: {
        extensionResolvedAt: new Date(),
        extensionUsed: grant ? true : match!.extensionUsed,
        extensionGrantedBy: grant ? ctx.user!.id : null,
        ...(newDeadline ? { proposalDeadlineAt: newDeadline } : {}),
      },
    });

    const partnerUsers = await query<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "companyId" = $1',
      [match!.partnerId],
    );
    await notify({
      event: grant ? "extension.granted" : "extension.denied",
      recipients: partnerUsers.map((u) => ({ userId: u.id })),
      vars: {
        briefTitle: match!.briefTitle,
        extensionHours: String(extensionHours),
        newDeadline: newDeadline?.toLocaleString() ?? "",
        deadline: match!.proposalDeadlineAt?.toLocaleString() ?? "",
      },
      link: `/partner/briefs/${match!.briefId}`,
      briefId: match!.briefId,
      matchId,
      idemKey: `ext-res:${matchId}:${grant}`,
    });

    revalidatePath(`/admin/briefs/${match!.briefId}`);
    return { ok: true as const };
  },
});
