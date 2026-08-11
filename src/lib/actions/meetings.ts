"use server";

/**
 * Admin meeting Server Actions — schedule and cancel syncs between
 * customers and partners via Google Calendar + Meet.
 *
 * Wrapped in `defineAction` for input validation, RBAC, rate limiting,
 * and audit logging. The admin must have a connected Google Calendar
 * (see `/api/admin/google/connect`) before any of these succeed.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { invalidInput } from "@/lib/schemas/errors";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import type { MeetingRow } from "@/lib/db/rows";
import {
  createCalendarEvent,
  cancelCalendarEvent,
  getCalendarClientForAdmin,
} from "@/lib/google-calendar";

// ─── Shared helpers ───────────────────────────────────────────────

/** Default duration of an instant meeting, in minutes. */
const INSTANT_DURATION_MIN = 30;

const BaseMeetingFields = z.object({
  briefId: z.string().min(1).optional().nullable(),
  /** When set, invite the brief's customer (owner). */
  includeCustomer: z.boolean().default(true),
  /** When set, invite a partner attached to the brief. */
  includePartner: z.boolean().default(true),
  /**
   * Optional explicit partner company id — required when the admin
   * wants to invite a partner that isn't already matched to the brief,
   * or when scheduling a brief-less meeting.
   */
  partnerCompanyId: z.string().min(1).optional().nullable(),
  /** Optional explicit customer email override (for ad-hoc meetings). */
  customerEmailOverride: z.string().email().optional().nullable(),
  /**
   * Optional customer User id chosen from the directory (ad-hoc, no
   * brief). Resolved to the user's email + name server-side so the
   * meeting links the real account and notifications fire.
   */
  customerUserId: z.string().min(1).optional().nullable(),
  title: z.string().min(2).max(140),
  agenda: z.string().max(4000).optional().nullable(),
});

/**
 * Resolve attendees from a brief + role toggles. Returns:
 *   - customer: the brief owner User (or null if includeCustomer=false / no brief)
 *   - partner:  one User row for the partner company (preferring the
 *               partner's lead-routing inbox via PartnerProfile, but
 *               falling back to a PARTNER-role user on the company).
 */
async function resolveAttendees(opts: {
  briefId: string | null | undefined;
  includeCustomer: boolean;
  includePartner: boolean;
  partnerCompanyId: string | null | undefined;
  customerEmailOverride: string | null | undefined;
  customerUserId: string | null | undefined;
}) {
  let customerUserId: string | null = null;
  let customerEmail: string | null = null;
  let customerName: string | null = null;
  let partnerUserId: string | null = null;
  let partnerEmail: string | null = null;
  let partnerName: string | null = null;
  let brief: {
    id: string;
    title: string;
    ownerId: string;
    companyId: string;
  } | null = null;

  if (opts.briefId) {
    const b = await queryOne<{
      id: string;
      title: string;
      ownerId: string;
      companyId: string;
      ownerEmail: string;
      ownerName: string | null;
    }>(
      `SELECT b."id", b."title", b."ownerId", b."companyId",
              u."email" AS "ownerEmail", u."name" AS "ownerName"
       FROM "ProjectBrief" b
       JOIN "User" u ON u."id" = b."ownerId"
       WHERE b."id" = $1`,
      [opts.briefId],
    );
    if (!b) fail({ code: "NOT_FOUND", resource: "ProjectBrief" });
    brief = {
      id: b!.id,
      title: b!.title,
      ownerId: b!.ownerId,
      companyId: b!.companyId,
    };
    if (opts.includeCustomer) {
      customerUserId = b!.ownerId;
      customerEmail = b!.ownerEmail;
      customerName = b!.ownerName ?? null;
    }
    if (opts.includePartner) {
      // Prefer the explicit partnerCompanyId; otherwise pick the first
      // accepted partner on the brief.
      const matches = await query<{ partnerId: string; status: string }>(
        `SELECT "partnerId", "status" FROM "Match"
         WHERE "briefId" = $1 ORDER BY "createdAt" ASC`,
        [opts.briefId],
      );
      const targetPartnerId =
        matches.find((m) => m.partnerId === opts.partnerCompanyId)?.partnerId ??
        matches.find((m) => m.status === "PARTNER_ACCEPTED")?.partnerId ??
        matches[0]?.partnerId ??
        null;
      if (targetPartnerId) {
        const resolved = await resolvePartnerContact(targetPartnerId);
        if (resolved) {
          partnerUserId = resolved.userId;
          partnerEmail = resolved.email;
          partnerName = resolved.name;
        }
      }
    }
  } else if (opts.includePartner && opts.partnerCompanyId) {
    // Ad-hoc meeting with a partner only (no brief).
    const resolved = await resolvePartnerContact(opts.partnerCompanyId);
    if (resolved) {
      partnerUserId = resolved.userId;
      partnerEmail = resolved.email;
      partnerName = resolved.name;
    }
  }

  // No-brief: customer chosen from the directory by id. Resolve to the
  // real account so the meeting links it and notifications fire.
  if (
    !opts.briefId &&
    opts.includeCustomer &&
    opts.customerUserId &&
    !customerEmail
  ) {
    const u = await queryOne<{
      id: string;
      email: string;
      name: string | null;
    }>('SELECT "id", "email", "name" FROM "User" WHERE "id" = $1', [
      opts.customerUserId,
    ]);
    if (u) {
      customerUserId = u.id;
      customerEmail = u.email;
      customerName = u.name ?? null;
    }
  }

  // Customer-email override for ad-hoc invites (when no account is linked).
  if (opts.includeCustomer && opts.customerEmailOverride && !customerEmail) {
    customerEmail = opts.customerEmailOverride;
  }

  return {
    brief,
    customer: customerEmail
      ? { userId: customerUserId, email: customerEmail, name: customerName }
      : null,
    partner: partnerEmail
      ? { userId: partnerUserId, email: partnerEmail, name: partnerName }
      : null,
  };
}

/** Resolve the best partner contact (userId, email, display name) for
 *  a partner company — preferring the lead-routing inbox, then a
 *  PARTNER-role user, then any user on the company. */
async function resolvePartnerContact(
  partnerCompanyId: string,
): Promise<{ userId: string; email: string; name: string } | null> {
  const partner = await queryOne<{
    id: string;
    name: string;
    leadRoutingEmail: string | null;
  }>(
    `SELECT c."id", c."name", pp."leadRoutingEmail"
     FROM "Company" c
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE c."id" = $1`,
    [partnerCompanyId],
  );
  if (!partner) return null;
  const partnerUser = await queryOne<{ id: string; email: string }>(
    `SELECT "id", "email" FROM "User"
     WHERE "companyId" = $1
     ORDER BY ("role" = 'PARTNER') DESC, "createdAt" ASC
     LIMIT 1`,
    [partnerCompanyId],
  );
  if (!partnerUser) return null;
  return {
    userId: partnerUser.id,
    email: partner.leadRoutingEmail ?? partnerUser.email,
    name: partner.name,
  };
}

/** Notify a list of user ids about a meeting. Best-effort — never throws. */
async function notifyMeetingParticipants(opts: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  link: string;
}) {
  if (opts.userIds.length === 0) return;
  for (const userId of opts.userIds) {
    await insertRow("Notification", {
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link,
    }).catch(() => undefined);
  }
}

// ─── Create instant meeting (starts now + 30min) ──────────────────

const CreateInstantInput = BaseMeetingFields;

export const createInstantMeetingAction = defineAction({
  name: "admin.meeting.instant",
  input: CreateInstantInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.meeting.instant", limit: 30, windowSec: 60 },
  handler: async (input, ctx) => {
    const cal = await getCalendarClientForAdmin(ctx.user!.id);
    if (!cal) fail({ code: "FORBIDDEN", reason: "calendar_not_connected" });

    if (!input.includeCustomer && !input.includePartner) {
      fail(invalidInput("Select at least one attendee.", "includeCustomer"));
    }

    const resolved = await resolveAttendees({
      briefId: input.briefId ?? null,
      includeCustomer: input.includeCustomer,
      includePartner: input.includePartner,
      partnerCompanyId: input.partnerCompanyId ?? null,
      customerEmailOverride: input.customerEmailOverride ?? null,
      customerUserId: input.customerUserId ?? null,
    });

    if (!resolved.customer && !resolved.partner) {
      fail(invalidInput("Could not resolve any attendee email.", "attendees"));
    }

    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + INSTANT_DURATION_MIN * 60_000,
    );

    const attendees: { email: string; displayName?: string | null }[] = [];
    if (resolved.customer)
      attendees.push({
        email: resolved.customer.email,
        displayName: resolved.customer.name,
      });
    if (resolved.partner)
      attendees.push({
        email: resolved.partner.email,
        displayName: resolved.partner.name,
      });

    const event = await createCalendarEvent({
      adminUserId: ctx.user!.id,
      title: input.title,
      description: input.agenda ?? undefined,
      startsAt,
      endsAt,
      timeZone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      attendees,
    });

    const meeting = await insertRow<{ id: string }>("Meeting", {
      organizerId: ctx.user!.id,
      briefId: resolved.brief?.id ?? null,
      customerUserId: resolved.customer?.userId ?? null,
      partnerUserId: resolved.partner?.userId ?? null,
      title: input.title,
      agenda: input.agenda ?? null,
      kind: "INSTANT",
      startsAt,
      endsAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      meetLink: event.meetLink,
      googleEventId: event.eventId,
      googleHtmlLink: event.htmlLink,
      status: "SCHEDULED",
    });

    await notifyMeetingParticipants({
      userIds: [
        resolved.customer?.userId,
        resolved.partner?.userId,
      ].filter((v): v is string => Boolean(v)),
      type: "meeting.scheduled",
      title: "Instant meeting starting now",
      message: `Join "${input.title}" — it just started.`,
      link: event.meetLink ?? event.htmlLink ?? "/dashboard",
    });

    revalidatePath("/admin/meetings");
    if (resolved.brief?.id) {
      revalidatePath(`/admin/briefs/${resolved.brief.id}`);
    }

    return {
      ok: true as const,
      meetingId: meeting.id,
      meetLink: event.meetLink,
      htmlLink: event.htmlLink,
    };
  },
});

// ─── Create scheduled meeting (admin-picked datetime) ─────────────

const CreateScheduledInput = BaseMeetingFields.extend({
  /** ISO datetime string of the meeting start. */
  startsAt: z.string().min(1),
  /** Duration in minutes (15..240). */
  durationMin: z.coerce.number().int().min(15).max(240).default(30),
  /** IANA timezone, e.g. "Europe/Amsterdam". */
  timeZone: z.string().min(1).default("UTC"),
});

export const createScheduledMeetingAction = defineAction({
  name: "admin.meeting.scheduled",
  input: CreateScheduledInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.meeting.scheduled", limit: 60, windowSec: 60 },
  handler: async (input, ctx) => {
    const cal = await getCalendarClientForAdmin(ctx.user!.id);
    if (!cal) fail({ code: "FORBIDDEN", reason: "calendar_not_connected" });

    if (!input.includeCustomer && !input.includePartner) {
      fail(invalidInput("Select at least one attendee.", "includeCustomer"));
    }

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      fail(invalidInput("Please choose a valid date/time.", "startsAt"));
    }
    if (startsAt.getTime() < Date.now() - 60_000) {
      fail(invalidInput("Start time must be in the future.", "startsAt"));
    }
    const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);

    const resolved = await resolveAttendees({
      briefId: input.briefId ?? null,
      includeCustomer: input.includeCustomer,
      includePartner: input.includePartner,
      partnerCompanyId: input.partnerCompanyId ?? null,
      customerEmailOverride: input.customerEmailOverride ?? null,
      customerUserId: input.customerUserId ?? null,
    });

    if (!resolved.customer && !resolved.partner) {
      fail(invalidInput("Could not resolve any attendee email.", "attendees"));
    }

    const attendees: { email: string; displayName?: string | null }[] = [];
    if (resolved.customer)
      attendees.push({
        email: resolved.customer.email,
        displayName: resolved.customer.name,
      });
    if (resolved.partner)
      attendees.push({
        email: resolved.partner.email,
        displayName: resolved.partner.name,
      });

    const event = await createCalendarEvent({
      adminUserId: ctx.user!.id,
      title: input.title,
      description: input.agenda ?? undefined,
      startsAt,
      endsAt,
      timeZone: input.timeZone,
      attendees,
    });

    const meeting = await insertRow<{ id: string }>("Meeting", {
      organizerId: ctx.user!.id,
      briefId: resolved.brief?.id ?? null,
      customerUserId: resolved.customer?.userId ?? null,
      partnerUserId: resolved.partner?.userId ?? null,
      title: input.title,
      agenda: input.agenda ?? null,
      kind: "SCHEDULED",
      startsAt,
      endsAt,
      timeZone: input.timeZone,
      meetLink: event.meetLink,
      googleEventId: event.eventId,
      googleHtmlLink: event.htmlLink,
      status: "SCHEDULED",
    });

    const when = startsAt.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: input.timeZone,
    });

    await notifyMeetingParticipants({
      userIds: [
        resolved.customer?.userId,
        resolved.partner?.userId,
      ].filter((v): v is string => Boolean(v)),
      type: "meeting.scheduled",
      title: "New meeting scheduled",
      message: `"${input.title}" — ${when} (${input.timeZone}).`,
      link: event.htmlLink ?? "/dashboard",
    });

    revalidatePath("/admin/meetings");
    if (resolved.brief?.id) {
      revalidatePath(`/admin/briefs/${resolved.brief.id}`);
    }

    return {
      ok: true as const,
      meetingId: meeting.id,
      meetLink: event.meetLink,
      htmlLink: event.htmlLink,
    };
  },
});

// ─── Cancel meeting ───────────────────────────────────────────────

const CancelMeetingInput = z.object({
  meetingId: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

export const cancelMeetingAction = defineAction({
  name: "admin.meeting.cancel",
  input: CancelMeetingInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.meeting.cancel", limit: 60, windowSec: 60 },
  handler: async (input) => {
    const meeting = await queryOne<MeetingRow>(
      'SELECT * FROM "Meeting" WHERE "id" = $1',
      [input.meetingId],
    );
    if (!meeting) fail({ code: "NOT_FOUND", resource: "Meeting" });
    if (meeting.status !== "SCHEDULED") {
      return { ok: true as const }; // already cancelled — idempotent
    }

    if (meeting.googleEventId) {
      try {
        await cancelCalendarEvent(meeting.organizerId, meeting.googleEventId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[meeting.cancel] google event delete failed", err);
      }
    }

    await updateRows(
      "Meeting",
      { id: meeting!.id },
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledReason: input.reason ?? null,
      },
    );

    await notifyMeetingParticipants({
      userIds: [meeting.customerUserId, meeting.partnerUserId].filter(
        (v): v is string => Boolean(v),
      ),
      type: "meeting.cancelled",
      title: "Meeting cancelled",
      message: `"${meeting.title}" was cancelled${
        input.reason ? `: ${input.reason}` : ""
      }.`,
      link: "/dashboard",
    });

    revalidatePath("/admin/meetings");
    if (meeting.briefId) revalidatePath(`/admin/briefs/${meeting.briefId}`);

    return { ok: true as const };
  },
});
