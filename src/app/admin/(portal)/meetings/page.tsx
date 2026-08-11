import Link from "next/link";
import {
  CalendarClock,
  Video,
  ExternalLink,
  CheckCircle2,
  Building2,
  UserCircle,
  Zap,
  CalendarPlus,
  AlertTriangle,
  Plug,
  CalendarDays,
} from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingButton } from "@/components/admin/schedule-meeting-button";
import { CancelMeetingButton } from "@/components/admin/cancel-meeting-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SCHEDULED: {
    label: "Scheduled",
    cls: "border-blue-200 text-blue-700 bg-blue-50",
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "border-red-200 text-red-700 bg-red-50",
  },
  COMPLETED: {
    label: "Completed",
    cls: "border-emerald-200 text-emerald-700 bg-emerald-50",
  },
};

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const connectedFlag = sp.connected === "1";
  const disconnectedFlag = sp.disconnected === "1";
  const errorFlag =
    typeof sp.error === "string" ? sp.error : null;

  const [token, partners, customersRaw, meetingsRaw] = await Promise.all([
    queryOne<{ accountEmail: string | null }>(
      'SELECT "accountEmail" FROM "GoogleCalendarToken" WHERE "userId" = $1',
      [userId],
    ),
    query<{ id: string; name: string }>(
      `SELECT "id", "name" FROM "Company" WHERE "kind" = 'PARTNER' ORDER BY "name" ASC`,
    ),
    query<{
      id: string;
      name: string | null;
      email: string;
      companyName: string | null;
    }>(
      `SELECT u."id", u."name", u."email", c."name" AS "companyName"
       FROM "User" u LEFT JOIN "Company" c ON c."id" = u."companyId"
       WHERE u."role" = 'CUSTOMER'
       ORDER BY u."name" ASC, u."email" ASC
       LIMIT 500`,
    ),
    query<{
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
      briefId: string | null;
      briefTitle: string | null;
      customerUserId: string | null;
      customerEmail: string | null;
      customerName: string | null;
      partnerUserId: string | null;
      partnerEmail: string | null;
      partnerName: string | null;
      partnerCompanyName: string | null;
    }>(
      `SELECT m."id", m."title", m."agenda", m."kind", m."status",
              m."startsAt", m."endsAt", m."timeZone", m."meetLink", m."googleHtmlLink",
              b."id" AS "briefId", b."title" AS "briefTitle",
              cu."id" AS "customerUserId", cu."email" AS "customerEmail", cu."name" AS "customerName",
              pu."id" AS "partnerUserId", pu."email" AS "partnerEmail", pu."name" AS "partnerName",
              pc."name" AS "partnerCompanyName"
       FROM "Meeting" m
       LEFT JOIN "ProjectBrief" b ON b."id" = m."briefId"
       LEFT JOIN "User" cu ON cu."id" = m."customerUserId"
       LEFT JOIN "User" pu ON pu."id" = m."partnerUserId"
       LEFT JOIN "Company" pc ON pc."id" = pu."companyId"
       WHERE m."organizerId" = $1
       ORDER BY m."startsAt" DESC
       LIMIT 50`,
      [userId],
    ),
  ]);

  const meetings: MeetingRowItem[] = meetingsRaw.map((m) => ({
    id: m.id,
    title: m.title,
    agenda: m.agenda,
    kind: m.kind,
    status: m.status,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    timeZone: m.timeZone,
    meetLink: m.meetLink,
    googleHtmlLink: m.googleHtmlLink,
    brief: m.briefId ? { id: m.briefId, title: m.briefTitle ?? "" } : null,
    customerUser: m.customerUserId
      ? { id: m.customerUserId, email: m.customerEmail ?? "", name: m.customerName }
      : null,
    partnerUser: m.partnerUserId
      ? {
          id: m.partnerUserId,
          email: m.partnerEmail ?? "",
          name: m.partnerName,
          company: m.partnerCompanyName ? { name: m.partnerCompanyName } : null,
        }
      : null,
  }));

  const now = Date.now();
  const upcoming = meetings.filter(
    (m) =>
      m.status === "SCHEDULED" && m.endsAt.getTime() >= now,
  );
  const past = meetings.filter(
    (m) =>
      m.status !== "SCHEDULED" || m.endsAt.getTime() < now,
  );

  const isConnected = Boolean(token);

  const customers = customersRaw.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    companyName: c.companyName ?? null,
  }));

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge
            variant="outline"
            className="mb-3 border-emerald-200 text-emerald-700 bg-emerald-50"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            MEETINGS
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Customer ↔ Partner Sync
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Schedule instant or future Google Meet calls between customers
            and partners. Invitees receive an .ics + Meet link via email
            and an in-app notification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <ScheduleMeetingButton
              partners={partners}
              customers={customers}
              label="New meeting"
              variant="default"
            />
          ) : null}
        </div>
      </header>

      {/* Flash messages */}
      {connectedFlag && (
        <FlashBanner
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Google Calendar connected"
          message="You can now schedule meetings on this account."
        />
      )}
      {disconnectedFlag && (
        <FlashBanner
          tone="muted"
          icon={<Plug className="h-4 w-4" />}
          title="Google Calendar disconnected"
          message="Reconnect to schedule new meetings."
        />
      )}
      {errorFlag && (
        <FlashBanner
          tone="error"
          icon={<AlertTriangle className="h-4 w-4" />}
          title={errorBannerTitle(errorFlag)}
          message={errorBannerMessage(errorFlag)}
        />
      )}

      {/* Connection card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-11 w-11 rounded-xl grid place-items-center shrink-0",
                isConnected
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {isConnected
                  ? "Google Calendar connected"
                  : "Connect Google Calendar"}
              </div>
              <div className="mt-0.5 text-[12.5px] text-slate-500">
                {isConnected ? (
                  <>
                    Organising as{" "}
                    <span className="font-mono text-slate-700">
                      {token?.accountEmail ?? "(unknown)"}
                    </span>
                    {" "}— Meet links auto-generate.
                  </>
                ) : (
                  "Authorise once. We only request calendar.events scope to create the events you schedule here."
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <form action="/api/admin/google/disconnect" method="post">
                <Button type="submit" variant="ghost" size="sm">
                  Disconnect
                </Button>
              </form>
            ) : null}
            <Button asChild size="sm" variant={isConnected ? "outline" : "default"}>
              <Link href="/api/admin/google/connect">
                <Plug className="h-3.5 w-3.5 mr-1.5" />
                {isConnected ? "Reconnect" : "Connect Google Calendar"}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            Upcoming
            <Badge variant="outline" className="ml-1">
              {upcoming.length}
            </Badge>
          </h2>
        </header>
        {upcoming.length === 0 ? (
          <EmptyMeetings
            isConnected={isConnected}
            partners={partners}
            customers={customers}
            kind="upcoming"
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            Past & cancelled
            <Badge variant="outline" className="ml-1">
              {past.length}
            </Badge>
          </h2>
          <div className="space-y-3">
            {past.map((m) => (
              <MeetingRow key={m.id} m={m} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

type MeetingRowItem = {
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
  brief: { id: string; title: string } | null;
  customerUser: { id: string; email: string; name: string | null } | null;
  partnerUser: {
    id: string;
    email: string;
    name: string | null;
    company: { name: string } | null;
  } | null;
};

function MeetingRow({ m, muted }: { m: MeetingRowItem; muted?: boolean }) {
  const status = STATUS_BADGE[m.status] ?? STATUS_BADGE.SCHEDULED;
  const when = m.startsAt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: m.timeZone || undefined,
  });
  const durationMin = Math.max(
    1,
    Math.round((m.endsAt.getTime() - m.startsAt.getTime()) / 60_000),
  );

  return (
    <Card
      className={cn(
        "bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow",
        muted && "opacity-80",
      )}
    >
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {m.kind === "INSTANT" ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 text-amber-700 bg-amber-50 text-[10px]"
                >
                  <Zap className="h-3 w-3 mr-1" /> INSTANT
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-slate-200 text-slate-600 bg-slate-50 text-[10px]"
                >
                  <CalendarClock className="h-3 w-3 mr-1" /> SCHEDULED
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px]", status.cls)}>
                {status.label}
              </Badge>
              <span className="text-[12px] font-mono text-slate-500">
                {when} · {durationMin}m · {m.timeZone}
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-900 truncate">
              {m.title}
            </h3>
            {m.agenda && (
              <p className="mt-1 text-[12.5px] text-slate-600 line-clamp-2">
                {m.agenda}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[12px] text-slate-700">
              {m.customerUser && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-100">
                  <UserCircle className="h-3.5 w-3.5 text-blue-600" />
                  {m.customerUser.name ?? m.customerUser.email}
                </span>
              )}
              {m.partnerUser && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  {m.partnerUser.company?.name ?? m.partnerUser.email}
                </span>
              )}
              {m.brief && (
                <Link
                  href={`/admin/briefs/${m.brief.id}`}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
                >
                  Brief: {m.brief.title}
                </Link>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {m.meetLink && m.status === "SCHEDULED" && (
              <Button asChild size="sm" variant="default">
                <a href={m.meetLink} target="_blank" rel="noopener noreferrer">
                  <Video className="h-3.5 w-3.5 mr-1.5" />
                  Join
                </a>
              </Button>
            )}
            {m.googleHtmlLink && (
              <Button asChild size="sm" variant="outline">
                <a
                  href={m.googleHtmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Calendar
                </a>
              </Button>
            )}
            {m.status === "SCHEDULED" && (
              <CancelMeetingButton meetingId={m.id} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyMeetings({
  isConnected,
  partners,
  customers,
  kind,
}: {
  isConnected: boolean;
  partners: { id: string; name: string }[];
  customers: {
    id: string;
    name: string | null;
    email: string;
    companyName: string | null;
  }[];
  kind: "upcoming" | "past";
}) {
  return (
    <Card className="bg-white border-slate-200 border-dashed shadow-none">
      <CardContent className="p-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center">
          <CalendarPlus className="h-5 w-5 text-slate-500" />
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {kind === "upcoming"
            ? "No meetings scheduled yet"
            : "Nothing in history"}
        </div>
        <p className="text-[12.5px] text-slate-500 max-w-md mx-auto">
          {isConnected
            ? "Use the New meeting button to create an instant or scheduled sync."
            : "Connect Google Calendar above to start scheduling meetings."}
        </p>
        {isConnected && (
          <ScheduleMeetingButton
            partners={partners}
            customers={customers}
            label="Schedule a meeting"
          />
        )}
      </CardContent>
    </Card>
  );
}

function FlashBanner({
  tone,
  icon,
  title,
  message,
}: {
  tone: "success" | "error" | "muted";
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-start gap-3", cls)}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-[12.5px] mt-0.5 opacity-90">{message}</div>
      </div>
    </div>
  );
}

function errorBannerTitle(code: string): string {
  switch (code) {
    case "not_configured":
      return "Google Calendar OAuth client not configured";
    case "not_connected":
      return "Connect Google Calendar first";
    case "bad_state":
      return "OAuth state mismatch";
    case "missing_code":
      return "Authorization code missing";
    case "exchange_failed":
      return "Token exchange failed";
    default:
      return "Couldn't complete the request";
  }
}

function errorBannerMessage(code: string): string {
  switch (code) {
    case "not_configured":
      return "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in your environment.";
    case "not_connected":
      return "Click Connect Google Calendar above to authorize this admin account.";
    case "bad_state":
      return "Try connecting again. The state cookie likely expired.";
    case "missing_code":
      return "Google didn't return an authorization code. Try again.";
    case "exchange_failed":
      return "We couldn't trade the code for tokens. Check the OAuth client redirect URI matches /api/admin/google/callback.";
    default:
      return "Please try again, or reconnect Google Calendar.";
  }
}
