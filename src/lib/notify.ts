/**
 * Notification service — plan-A §9 notification matrix.
 *
 * One entry point (`notify`) for every platform event:
 *   1. Renders the template — DB override (`NotificationTemplate`,
 *      admin-editable) falling back to the built-in defaults below.
 *   2. Creates an in-app `Notification` row for each recipient user.
 *   3. Enqueues an email via the background job queue (provider is
 *      pluggable; "mock" in dev).
 *
 * Templates use `{{placeholder}}` substitution. Every send is
 * observable via the `Email` table + `Notification` rows.
 */

import "server-only";
import { query, queryOne, insertRow } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";

/** §9 event keys. P0/P1 all wired; priorities noted for reference. */
export const NOTIFICATION_EVENTS = {
  // 3 — call-generated brief ready for review (P0)
  "brief.call_generated_ready": {
    subject: "Your project brief is ready for review",
    body: "We turned your call into a structured project brief: \"{{briefTitle}}\". Please review it and confirm we captured everything correctly.\n\n{{link}}",
    description: "Call-generated brief ready for company review (M3 Path B).",
  },
  // 2 — draft abandoned (P1)
  "brief.draft_reminder": {
    subject: "Your project brief is waiting",
    body: "Your draft brief \"{{briefTitle}}\" hasn't moved in {{days}} days. Pick it back up whenever you're ready.\n\n{{link}}",
    description: "Nudge for abandoned draft briefs.",
  },
  // 4 — clarification request (P0)
  "clarification.new_message": {
    subject: "New clarification message on \"{{briefTitle}}\"",
    body: "{{fromLabel}} wrote:\n\n{{preview}}\n\nReply by message or pick a call slot.\n\n{{link}}",
    description: "New message in a clarification thread (any context).",
  },
  // 5 — lead invite sent (P0)
  "invite.sent": {
    subject: "New lead: {{briefTitle}}",
    body: "You've been matched to an anonymized lead: {{anonymizedSummary}}.\n\nAccept or decline within {{acceptHours}}h.\n\n{{link}}",
    description: "Anonymized lead invite to partner contacts.",
  },
  // 6 — T1/T2 reminders (P0)
  "invite.accept_reminder": {
    subject: "Reminder: lead acceptance closes in {{hoursLeft}}h",
    body: "The lead \"{{briefTitle}}\" is waiting for your accept/decline. The window closes in {{hoursLeft}}h.\n\n{{link}}",
    description: "T1 reminder before the acceptance deadline.",
  },
  "invite.proposal_reminder": {
    subject: "Reminder: proposal due in {{hoursLeft}}h",
    body: "Your proposal for \"{{briefTitle}}\" is due in {{hoursLeft}}h. One 24h extension can be requested if you need it.\n\n{{link}}",
    description: "T2 reminder before the proposal deadline.",
  },
  // 7 — expiries (P0)
  "invite.expired": {
    subject: "Lead invite expired: {{briefTitle}}",
    body: "The acceptance window for \"{{briefTitle}}\" has passed and the invite expired.",
    description: "T1 expiry — sent to the partner.",
  },
  "invite.expired_admin": {
    subject: "Invite expired — consider a replacement partner",
    body: "{{partnerName}} did not respond to \"{{briefTitle}}\" in time. Consider inviting a replacement partner.\n\n{{link}}",
    description: "T1 expiry — sent to admins with replacement suggestion.",
  },
  "proposal.expired": {
    subject: "Proposal deadline passed: {{briefTitle}}",
    body: "The proposal deadline for \"{{briefTitle}}\" has passed. Contact the AIPartner team if you still want to participate.",
    description: "T2 expiry — sent to the partner.",
  },
  "proposal.expired_admin": {
    subject: "Proposal deadline passed for {{partnerName}}",
    body: "{{partnerName}} did not submit a proposal for \"{{briefTitle}}\" before the deadline. You can re-open the invite with a new deadline.\n\n{{link}}",
    description: "T2 expiry — sent to admins (re-open possible).",
  },
  // 8/9 — extension flow (P0)
  "extension.requested": {
    subject: "Extension requested: {{briefTitle}}",
    body: "{{partnerName}} requested a one-time proposal deadline extension for \"{{briefTitle}}\".\n\nStatus note: {{note}}\n\n{{link}}",
    description: "Partner requested the one-time extension — sent to admins.",
  },
  "extension.granted": {
    subject: "Extension granted: +{{extensionHours}}h",
    body: "Your extension for \"{{briefTitle}}\" was granted. New deadline: {{newDeadline}}.\n\n{{link}}",
    description: "Extension granted — sent to the partner.",
  },
  "extension.denied": {
    subject: "Extension request declined",
    body: "Your extension request for \"{{briefTitle}}\" was declined. The original deadline stands: {{deadline}}.\n\n{{link}}",
    description: "Extension denied — sent to the partner.",
  },
  // 10 — competitor submitted (P1, "war zone")
  "invite.competitor_submitted": {
    subject: "Another partner has submitted for {{briefTitle}}",
    body: "Another partner has already submitted a proposal for the lead \"{{briefTitle}}\". Submission order is visible to the customer.\n\n{{link}}",
    description: "Competitive-pressure notification to other accepted partners.",
  },
  // 11 — proposal submitted (P0)
  "proposal.submitted_admin": {
    subject: "Proposal submitted: {{briefTitle}}",
    body: "{{partnerName}} submitted a proposal for \"{{briefTitle}}\" (submission #{{submissionRank}}). It's ready for QC.\n\n{{link}}",
    description: "Proposal submitted — sent to admins for QC.",
  },
  // 12 — QC clarification (P0)
  "qc.clarification": {
    subject: "Clarification needed on your proposal",
    body: "The AIPartner team has questions on your proposal for \"{{briefTitle}}\":\n\n{{preview}}\n\nReply by message or pick a call slot.\n\n{{link}}",
    description: "QC clarification — sent to the partner.",
  },
  // 13 — comparison released (P0)
  "comparison.released": {
    subject: "Partner proposals are ready to compare",
    body: "Proposals for \"{{briefTitle}}\" are ready in your comparison view. You have {{selectHours}}h to select up to 3 partners.\n\n{{link}}",
    description: "Comparison (column) released — sent to company users.",
  },
  "comparison.column_released": {
    subject: "A new proposal joined your comparison",
    body: "Another partner column was released on \"{{briefTitle}}\". Open the comparison to review it side-by-side.\n\n{{link}}",
    description: "Staggered column release — sent to company users.",
  },
  // 14 — selection reminder (P0)
  "selection.reminder": {
    subject: "Reminder: partner selection closes in {{hoursLeft}}h",
    body: "Your selection window for \"{{briefTitle}}\" closes in {{hoursLeft}}h. Select up to 3 partners to meet.\n\n{{link}}",
    description: "Company selection deadline reminder.",
  },
  "selection.expired_admin": {
    subject: "Company selection window passed: {{briefTitle}}",
    body: "The company hasn't selected partners for \"{{briefTitle}}\" within the window. Manual chase recommended (no auto-cancel).\n\n{{link}}",
    description: "Selection expiry — admin manual chase.",
  },
  // 15/16 — selected / not selected (P0)
  "partner.selected": {
    subject: "You've been selected: {{briefTitle}}",
    body: "Congratulations — the customer selected your proposal for \"{{briefTitle}}\". Please confirm one of the proposed meeting times.\n\n{{link}}",
    description: "Selected partner notification.",
  },
  "partner.not_selected": {
    subject: "Update on {{briefTitle}}",
    body: "The customer decided to move forward with other partners for \"{{briefTitle}}\". Thank you for the time you invested — your proposal was strong and we look forward to matching you with the next opportunity.",
    description: "Respectful not-selected notification (partner retention matters).",
  },
  // 17 — meetings (P0)
  "meeting.slots_proposed": {
    subject: "Meeting times proposed: {{briefTitle}}",
    body: "Meeting time suggestions for \"{{briefTitle}}\":\n\n{{slots}}\n\nConfirm a slot or propose alternatives.\n\n{{link}}",
    description: "Meeting slot proposals to the counterparty.",
  },
  "meeting.confirmed": {
    subject: "Meeting confirmed: {{briefTitle}}",
    body: "Your intro meeting for \"{{briefTitle}}\" is confirmed for {{slot}}. Calendar invites follow.\n\n{{link}}",
    description: "Meeting slot confirmed.",
  },
  // 18 — meeting summaries (P1)
  "meeting.summaries_ready": {
    subject: "Your partner meeting summaries are ready",
    body: "Summaries of all partner intro calls for \"{{briefTitle}}\" are ready.\n\n{{link}}",
    description: "Compiled meeting summaries to the company.",
  },
  // 19 — lead stalled (P0)
  "lead.stalled": {
    subject: "Lead stalled: {{briefTitle}}",
    body: "All partner invites for \"{{briefTitle}}\" have expired or been declined. Re-select partners to keep the lead moving.\n\n{{link}}",
    description: "All invites dead — admin must re-select partners.",
  },
} as const;

export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? vars[key] : `{{${key}}}`,
  );
}

async function resolveTemplate(
  event: NotificationEvent,
): Promise<{ subject: string; body: string }> {
  const override = await queryOne<{ subject: string; body: string }>(
    'SELECT "subject", "body" FROM "NotificationTemplate" WHERE "key" = $1',
    [event],
  ).catch(() => null);
  if (override) return { subject: override.subject, body: override.body };
  const def = NOTIFICATION_EVENTS[event];
  return { subject: def.subject, body: def.body };
}

export interface NotifyRecipient {
  userId?: string;
  email?: string;
}

export interface NotifyOptions {
  event: NotificationEvent;
  recipients: NotifyRecipient[];
  vars?: Record<string, string>;
  /** In-app notification link (also substituted as {{link}}). */
  link?: string;
  /** Loose FK context recorded on the Email rows. */
  briefId?: string;
  matchId?: string;
  /** Idempotency suffix — prevents duplicate sends for the same event instance. */
  idemKey?: string;
}

/**
 * Fan a §9 event out to in-app notifications + emails. Never throws —
 * notification failure must not break the triggering action.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  try {
    const vars = { ...(opts.vars ?? {}), link: opts.link ?? "" };
    const { subject, body } = await resolveTemplate(opts.event);
    const renderedSubject = render(subject, vars);
    const renderedBody = render(body, vars);

    // Resolve missing emails for userId-only recipients in one query.
    const userIds = opts.recipients
      .filter((r) => r.userId && !r.email)
      .map((r) => r.userId!) as string[];
    const users = userIds.length
      ? await query<{ id: string; email: string }>(
          'SELECT "id", "email" FROM "User" WHERE "id" = ANY($1)',
          [userIds],
        )
      : [];
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

    for (const recipient of opts.recipients) {
      const email = recipient.email ?? emailByUserId.get(recipient.userId ?? "");

      if (recipient.userId) {
        await insertRow(
          "Notification",
          {
            userId: recipient.userId,
            type: opts.event,
            title: renderedSubject,
            message: renderedBody.slice(0, 2000),
            link: opts.link ?? null,
          },
          { noUpdatedAt: true },
        ).catch(() => undefined);
      }

      if (email) {
        await enqueue(
          "email.send",
          {
            toAddress: email,
            subject: renderedSubject,
            body: renderedBody,
            kind: "notification",
            briefId: opts.briefId ?? null,
            matchId: opts.matchId ?? null,
          },
          {
            idemKey: opts.idemKey
              ? `${opts.event}:${opts.idemKey}:${email}`
              : undefined,
          },
        ).catch(() => undefined);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[notify] failed for ${opts.event}`, err);
  }
}

/** Notify every platform admin. */
export async function notifyAdmins(
  opts: Omit<NotifyOptions, "recipients">,
): Promise<void> {
  const admins = await query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "role" = $1',
    ["ADMIN"],
  );
  await notify({
    ...opts,
    recipients: admins.map((a) => ({ userId: a.id })),
  });
}

/** Notify every user of a company (customer org or partner org). */
export async function notifyCompanyUsers(
  companyId: string,
  opts: Omit<NotifyOptions, "recipients">,
): Promise<void> {
  const users = await query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "companyId" = $1',
    [companyId],
  );
  await notify({
    ...opts,
    recipients: users.map((u) => ({ userId: u.id })),
  });
}
