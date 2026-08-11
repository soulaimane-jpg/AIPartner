import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { CallsPageClient } from "./calls-page-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calls · AI Partner" };

type MeetingItem = {
  id: string;
  title: string;
  agenda: string | null;
  kind: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  meetLink: string | null;
  googleHtmlLink: string | null;
  transcript: string | null;
  transcriptStatus: string;
  organizerName: string | null;
  organizerEmail: string | null;
};

export default async function CallsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/calls");

  const meetings = await query<MeetingItem>(
    `SELECT m."id", m."title", m."agenda", m."kind", m."status",
            m."startsAt", m."endsAt", m."timeZone", m."meetLink", m."googleHtmlLink",
            m."transcript", m."transcriptStatus",
            u."name" AS "organizerName", u."email" AS "organizerEmail"
     FROM "Meeting" m
     LEFT JOIN "User" u ON u."id" = m."organizerId"
     WHERE m."customerUserId" = $1
     ORDER BY m."startsAt" DESC`,
    [session.user.id],
  );

  const now = Date.now();
  const upcoming = meetings.filter(
    (m) => m.status === "SCHEDULED" && m.endsAt.getTime() >= now,
  );
  const past = meetings.filter(
    (m) => m.status !== "SCHEDULED" || m.endsAt.getTime() < now,
  );

  return (
    <CallsPageClient
      upcoming={upcoming.map(serializeMeeting)}
      past={past.map(serializeMeeting)}
    />
  );
}

function serializeMeeting(m: MeetingItem) {
  return {
    id: m.id,
    title: m.title,
    agenda: m.agenda,
    kind: m.kind,
    status: m.status,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    timeZone: m.timeZone,
    meetLink: m.meetLink,
    googleHtmlLink: m.googleHtmlLink,
    transcript: m.transcript,
    transcriptStatus: m.transcriptStatus,
    organizerName: m.organizerName,
    organizerEmail: m.organizerEmail,
  };
}
