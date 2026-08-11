/**
 * Timer expiry + reminder handlers — plan-A §7 behaviour matrix.
 *
 * | Timer            | On expiry                                              |
 * |------------------|--------------------------------------------------------|
 * | lead_accept (T1) | Invite → EXPIRED; admin notified w/ replacement hint   |
 * | proposal (T2)    | Invite → PROPOSAL_EXPIRED; admin notified; re-openable |
 * | company_select   | Admin notified for manual chase — **no auto-cancel**   |
 * | stagger_release  | Next comparison column auto-releases (if QC-passed)    |
 *
 * All transitions run as the `system` actor and are audit-logged.
 */

import "server-only";
import { query, queryOne } from "@/lib/db";
import type { TimerInstanceRow } from "@/lib/db/rows";
import { transitionInvite } from "@/lib/state-machine/invite";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { SYSTEM_ACTOR } from "@/lib/state-machine/transition";
import { notify, notifyAdmins, notifyCompanyUsers } from "@/lib/notify";
import { releaseNextComparisonColumn } from "@/lib/comparison/release";

function parseMeta(timer: TimerInstanceRow): Record<string, unknown> {
  try {
    return JSON.parse(timer.meta) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface MatchContext {
  id: string;
  status: string;
  brief: { id: string; title: string };
  partner: { id: string; name: string; users: { id: string }[] };
}

async function matchContext(matchId: string): Promise<MatchContext | null> {
  const row = await queryOne<{
    id: string;
    status: string;
    briefId: string;
    briefTitle: string;
    partnerId: string;
    partnerName: string;
  }>(
    `SELECT m."id", m."status", b."id" AS "briefId", b."title" AS "briefTitle",
            c."id" AS "partnerId", c."name" AS "partnerName"
     FROM "Match" m
     JOIN "ProjectBrief" b ON b."id" = m."briefId"
     JOIN "Company" c ON c."id" = m."partnerId"
     WHERE m."id" = $1`,
    [matchId],
  );
  if (!row) return null;
  const users = await query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "companyId" = $1',
    [row.partnerId],
  );
  return {
    id: row.id,
    status: row.status,
    brief: { id: row.briefId, title: row.briefTitle },
    partner: { id: row.partnerId, name: row.partnerName, users },
  };
}

/** Route an expired timer to its behaviour. */
export async function runExpiryAction(timer: TimerInstanceRow): Promise<void> {
  switch (timer.onExpiryAction ?? timer.timerType) {
    case "lead_accept": {
      const match = await matchContext(timer.entityId);
      if (!match) return;
      // Only expire if the invite is still awaiting a response —
      // satisfy/decline may have raced the sweep.
      if (match.status !== "INVITED") return;

      await transitionInvite({
        matchId: match.id,
        to: "EXPIRED",
        actor: SYSTEM_ACTOR,
        reason: "T1 acceptance window elapsed",
      });
      await notify({
        event: "invite.expired",
        recipients: match.partner.users.map((u) => ({ userId: u.id })),
        vars: { briefTitle: match.brief.title },
        briefId: match.brief.id,
        matchId: match.id,
        idemKey: timer.id,
      });
      await notifyAdmins({
        event: "invite.expired_admin",
        vars: { briefTitle: match.brief.title, partnerName: match.partner.name },
        link: `/admin/briefs/${match.brief.id}`,
        briefId: match.brief.id,
        matchId: match.id,
        idemKey: timer.id,
      });
      await maybeStallLead(match.brief.id);
      return;
    }

    case "proposal_submit": {
      const match = await matchContext(timer.entityId);
      if (!match) return;
      if (
        match.status !== "PARTNER_ACCEPTED" &&
        match.status !== "EXTENSION_REQUESTED"
      ) {
        return; // proposal submitted or invite otherwise resolved
      }

      await transitionInvite({
        matchId: match.id,
        to: "PROPOSAL_EXPIRED",
        actor: SYSTEM_ACTOR,
        reason: "T2 proposal window elapsed",
      });
      await notify({
        event: "proposal.expired",
        recipients: match.partner.users.map((u) => ({ userId: u.id })),
        vars: { briefTitle: match.brief.title },
        briefId: match.brief.id,
        matchId: match.id,
        idemKey: timer.id,
      });
      await notifyAdmins({
        event: "proposal.expired_admin",
        vars: { briefTitle: match.brief.title, partnerName: match.partner.name },
        link: `/admin/briefs/${match.brief.id}`,
        briefId: match.brief.id,
        matchId: match.id,
        idemKey: timer.id,
      });
      await maybeStallLead(match.brief.id);
      return;
    }

    case "company_select": {
      const brief = await queryOne<{ id: string; title: string; leadState: string }>(
        'SELECT "id", "title", "leadState" FROM "ProjectBrief" WHERE "id" = $1',
        [timer.entityId],
      );
      if (!brief || brief.leadState !== "COMPARISON_RELEASED") return;
      // Plan-A M10.3: expiry notifies admin for manual chase; never auto-cancel.
      await notifyAdmins({
        event: "selection.expired_admin",
        vars: { briefTitle: brief.title },
        link: `/admin/briefs/${brief.id}`,
        briefId: brief.id,
        idemKey: timer.id,
      });
      return;
    }

    case "stagger_release": {
      const meta = parseMeta(timer);
      const briefId =
        typeof meta.briefId === "string" ? meta.briefId : timer.entityId;
      await releaseNextComparisonColumn(briefId);
      return;
    }

    default:
      // Unknown action — log loudly; never throw (sweep already marked expired).
      // eslint-disable-next-line no-console
      console.error(
        `[timers] no expiry handler for action "${timer.onExpiryAction}"`,
      );
  }
}

/** Send the reminder appropriate for the timer type. */
export async function runReminder(
  timer: TimerInstanceRow,
  _offsetHours: number,
  hoursLeft: number,
): Promise<void> {
  switch (timer.timerType) {
    case "lead_accept":
    case "proposal_submit": {
      const match = await matchContext(timer.entityId);
      if (!match) return;
      const awaiting =
        timer.timerType === "lead_accept"
          ? match.status === "INVITED"
          : match.status === "PARTNER_ACCEPTED" ||
            match.status === "EXTENSION_REQUESTED";
      if (!awaiting) return;

      await notify({
        event:
          timer.timerType === "lead_accept"
            ? "invite.accept_reminder"
            : "invite.proposal_reminder",
        recipients: match.partner.users.map((u) => ({ userId: u.id })),
        vars: {
          briefTitle: match.brief.title,
          hoursLeft: String(hoursLeft),
        },
        link: `/partner/briefs/${match.brief.id}`,
        briefId: match.brief.id,
        matchId: match.id,
        idemKey: `${timer.id}:${_offsetHours}`,
      });
      return;
    }

    case "company_select": {
      const brief = await queryOne<{
        id: string;
        title: string;
        companyId: string;
        leadState: string;
      }>(
        'SELECT "id", "title", "companyId", "leadState" FROM "ProjectBrief" WHERE "id" = $1',
        [timer.entityId],
      );
      if (!brief || brief.leadState !== "COMPARISON_RELEASED") return;
      await notifyCompanyUsers(brief.companyId, {
        event: "selection.reminder",
        vars: { briefTitle: brief.title, hoursLeft: String(hoursLeft) },
        link: `/briefs/${brief.id}/compare`,
        briefId: brief.id,
        idemKey: `${timer.id}:${_offsetHours}`,
      });
      return;
    }

    default:
      return; // stagger timers don't remind
  }
}

/**
 * If every invite on the lead is dead (expired / declined / withdrawn)
 * while the lead sits in SENT_TO_PARTNERS, flag it STALLED and notify
 * admins to re-select partners (§5.1).
 */
async function maybeStallLead(briefId: string): Promise<void> {
  const state = await getLeadState(briefId);
  if (state !== "SENT_TO_PARTNERS") return;

  const invites = await query<{ id: string }>(
    `SELECT "id" FROM "Match"
     WHERE "briefId" = $1 AND "status" = ANY($2)
     LIMIT 1`,
    [
      briefId,
      [
        "INVITED",
        "PARTNER_ACCEPTED",
        "EXTENSION_REQUESTED",
        "PROPOSAL_SUBMITTED",
        "QC_PASSED",
      ],
    ],
  );
  if (invites.length > 0) return; // something is still alive

  const brief = await queryOne<{ id: string; title: string }>(
    'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!brief) return;

  await transitionLead({
    briefId,
    to: "STALLED",
    actor: SYSTEM_ACTOR,
    reason: "All partner invites expired or declined",
  });
  await notifyAdmins({
    event: "lead.stalled",
    vars: { briefTitle: brief.title },
    link: `/admin/briefs/${briefId}`,
    briefId,
    idemKey: `stalled:${briefId}`,
  });
}
