"use server";

/**
 * Customer-facing meeting Server Actions.
 *
 * Customers schedule meetings with the CEO (soulaimane@aipartner.cloud).
 * The meeting is created on the CEO's Google Calendar (requires the CEO
 * to have connected their calendar via /admin/meetings).
 *
 * On confirm:
 *   1. Google Calendar event with Meet link is created (CEO as organizer).
 *   2. Confirmation email is sent to the customer AND the CEO.
 *   3. A Meeting row is persisted.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { queryOne, insertRow } from "@/lib/db";
import { createCalendarEvent, getCalendarClientForAdmin } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/email/provider";

const CEO_EMAIL = "soulaimane@aipartner.cloud";

const scheduleMeetingSchema = z.object({
  title: z.string().min(2).max(140).default("Meeting with AI Partner"),
  startsAt: z.string().min(1),
  durationMin: z.coerce.number().int().min(15).max(120).default(30),
  timeZone: z.string().min(1).default("UTC"),
  agenda: z.string().max(4000).optional().nullable(),
});

export type ScheduleMeetingResult =
  | { ok: true; meetingId: string; meetLink: string | null }
  | { ok: false; error: string };

export async function scheduleCustomerMeetingAction(
  raw: unknown,
): Promise<ScheduleMeetingResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "You must be signed in to schedule a meeting." };
  }

  const parsed = scheduleMeetingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { title, startsAt, durationMin, timeZone, agenda } = parsed.data;

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Please choose a valid date/time." };
  }
  if (start.getTime() < Date.now() - 60_000) {
    return { ok: false, error: "Start time must be in the future." };
  }
  const end = new Date(start.getTime() + durationMin * 60_000);

  // Find the CEO admin user — their Google Calendar will be used.
  const ceo = await queryOne<{ id: string; email: string; name: string | null }>(
    `SELECT "id", "email", "name" FROM "User" WHERE "email" = $1 AND "role" = 'ADMIN'`,
    [CEO_EMAIL],
  );
  if (!ceo) {
    return {
      ok: false,
      error: "Meeting scheduling is not yet available. Please contact support.",
    };
  }

  // Check that the CEO has connected their Google Calendar.
  const cal = await getCalendarClientForAdmin(ceo.id);
  if (!cal) {
    return {
      ok: false,
      error:
        "Our calendar is not connected yet. Please email soulaimane@aipartner.cloud to schedule.",
    };
  }

  const attendees = [
    { email: session.user.email, displayName: session.user.name ?? undefined },
    { email: CEO_EMAIL, displayName: ceo.name ?? "Soulaimane Zarria" },
  ];

  let event;
  try {
    event = await createCalendarEvent({
      adminUserId: ceo.id,
      title,
      description: agenda ?? undefined,
      startsAt: start,
      endsAt: end,
      timeZone,
      attendees,
    });
  } catch (err) {
    console.error("[scheduleCustomerMeeting] calendar event creation failed", err);
    return {
      ok: false,
      error: "Could not create the calendar event. Please try again later.",
    };
  }

  // Persist the meeting row.
  const meeting = await insertRow<{ id: string }>("Meeting", {
    organizerId: ceo.id,
    briefId: null,
    customerUserId: session.user.id,
    partnerUserId: null,
    title,
    agenda: agenda ?? null,
    kind: "SCHEDULED",
    startsAt: start,
    endsAt: end,
    timeZone,
    meetLink: event.meetLink,
    googleEventId: event.eventId,
    googleHtmlLink: event.htmlLink,
    status: "SCHEDULED",
  });

  // Send confirmation emails to the customer and the CEO.
  const when = start.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  const emailBody = `Hello,\n\nA meeting has been scheduled on AI Partner.\n\nTitle: ${title}\nWhen: ${when} (${timeZone})\nDuration: ${durationMin} minutes\n${agenda ? `Agenda: ${agenda}\n` : ""}Google Meet link: ${event.meetLink ?? "(will be available in the calendar invite)"}\n\nYou can join the meeting directly from the Google Calendar invite or by clicking the Meet link above.\n\nBest regards,\nThe AI Partner Team`;

  await Promise.all([
    sendEmail({
      toAddress: session.user.email,
      subject: `Meeting scheduled: ${title}`,
      body: emailBody,
      kind: "meeting-confirmation",
    }),
    sendEmail({
      toAddress: CEO_EMAIL,
      subject: `New meeting scheduled: ${title} — ${session.user.name ?? session.user.email}`,
      body: `A new meeting has been scheduled by ${session.user.name ?? session.user.email}.\n\n${emailBody}`,
      kind: "meeting-confirmation",
    }),
  ]);

  revalidatePath("/calls");
  revalidatePath("/dashboard");

  return {
    ok: true,
    meetingId: meeting.id,
    meetLink: event.meetLink,
  };
}
