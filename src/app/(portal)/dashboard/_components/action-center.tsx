import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, CircleDashed, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/constants";
import type { UpcomingMeeting, WorkspaceBrief } from "./types";

export function ActionCenter({
  briefs,
  meetings,
}: {
  briefs: WorkspaceBrief[];
  meetings: UpcomingMeeting[];
}) {
  const actions = briefs
    .filter((brief) => brief.status !== "ARCHIVED" && (brief.hasActionRequired || (brief.status === "DRAFT" && brief.completion < 100)))
    .slice(0, 4);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="customer-panel overflow-hidden">
        <header className="customer-panel-header">
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">Needs your attention</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">The next decisions that keep projects moving.</p>
          </div>
          {actions.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[10.5px] font-semibold text-amber-700 ring-1 ring-amber-200/80">
              {actions.length} open
            </span>
          )}
        </header>
        <div className="divide-y divide-line">
          {actions.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <p className="mt-2 text-[13px] font-medium text-foreground">You&apos;re up to date</p>
              <p className="mt-1 text-[12px] text-muted-foreground">New decisions and scoping tasks will appear here.</p>
            </div>
          ) : (
            actions.map((brief) => (
              <Link
                key={brief.id}
                href={actionHref(brief)}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/45 sm:px-6"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200/80">
                  <CircleDashed className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-foreground">{brief.title}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                    {actionLabel(brief)} · {STAGE_LABELS[brief.stage] ?? brief.stage}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="customer-panel overflow-hidden">
        <header className="customer-panel-header">
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">Upcoming meetings</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">Scheduled calls with the AI Partner team.</p>
          </div>
          <Button asChild variant="ghost" size="xs">
            <Link href="/calls">View calls <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </header>
        <div className="divide-y divide-line">
          {meetings.length === 0 ? (
            <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center">
              <CalendarClock className="h-6 w-6 text-primary" />
              <p className="mt-2 text-[13px] font-medium text-foreground">No meeting scheduled</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Book a scoping or alignment call when you need one.</p>
              <Button asChild variant="outline" size="xs" className="mt-3">
                <Link href="/calls">Schedule meeting</Link>
              </Button>
            </div>
          ) : (
            meetings.map((meeting) => {
              const start = new Date(meeting.startsAt);
              return (
                <div key={meeting.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <span className="text-center font-mono text-[10px] font-semibold uppercase leading-tight">
                      {start.toLocaleDateString(undefined, { month: "short" })}
                      <strong className="block text-[14px] text-foreground">{start.getDate()}</strong>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-foreground">{meeting.title}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {meeting.timeZone}
                    </span>
                  </span>
                  {meeting.meetLink && (
                    <Button asChild size="xs">
                      <a href={meeting.meetLink} target="_blank" rel="noopener noreferrer"><Video className="h-3 w-3" /> Join</a>
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function actionHref(brief: WorkspaceBrief): string {
  if (brief.stage === "SELECTION" || brief.stage === "PROPOSALS") return `/briefs/${brief.id}/proposals`;
  if (brief.stage === "REVIEW") return `/briefs/${brief.id}/preview#matches`;
  return `/briefs/${brief.id}/builder`;
}

function actionLabel(brief: WorkspaceBrief): string {
  if (brief.stage === "SELECTION") return "Select a partner";
  if (brief.stage === "PROPOSALS") return "Review proposals";
  if (brief.stage === "REVIEW") return "Review partner matches";
  return `Continue scoping at ${brief.completion}%`;
}
