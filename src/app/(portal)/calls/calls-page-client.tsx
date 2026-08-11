"use client";

import { useState } from "react";
import {
  CalendarClock,
  Video,
  ExternalLink,
  FileText,
  CheckCircle2,
  XCircle,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerScheduleMeetingDialog } from "@/components/customer/schedule-meeting-dialog";

type MeetingItem = {
  id: string;
  title: string;
  agenda: string | null;
  kind: string;
  status: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  meetLink: string | null;
  googleHtmlLink: string | null;
  transcript: string | null;
  transcriptStatus: string;
  organizerName: string | null;
  organizerEmail: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "border-primary/20 bg-primary/10 text-primary" },
  CANCELLED: { label: "Cancelled", cls: "border-red-200 text-red-700 bg-red-50" },
  COMPLETED: { label: "Completed", cls: "border-emerald-200 text-emerald-700 bg-emerald-50" },
};

const TRANSCRIPT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Not yet processed", cls: "border-slate-200 text-slate-500 bg-slate-50" },
  PROCESSING: { label: "Processing…", cls: "border-amber-200 text-amber-700 bg-amber-50" },
  READY: { label: "Transcript available", cls: "border-emerald-200 text-emerald-700 bg-emerald-50" },
  FAILED: { label: "Transcript failed", cls: "border-red-200 text-red-700 bg-red-50" },
};

export function CallsPageClient({
  upcoming,
  past,
}: {
  upcoming: MeetingItem[];
  past: MeetingItem[];
}) {
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);

  return (
    <div className="page-container portal-page max-w-5xl py-6 sm:py-8 lg:py-10">
      {/* Header */}
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <Phone className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow">Communication</div>
            <h1 className="portal-page-title">Calls</h1>
            <p className="portal-page-description">
              View your upcoming meetings and past call transcripts.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setMeetingOpen(true)}
          className="w-full sm:w-auto"
        >
          <CalendarClock className="h-4 w-4 mr-1.5" />
          Schedule a meeting
        </Button>
      </header>

      <CustomerScheduleMeetingDialog open={meetingOpen} onOpenChange={setMeetingOpen} />

      {/* Upcoming */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold text-foreground">Upcoming</h2>
          <Badge variant="outline">{upcoming.length}</Badge>
        </div>
        {upcoming.length === 0 ? (
          <div className="customer-panel space-y-4 border-dashed bg-card px-6 py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-secondary border border-border grid place-items-center">
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-[15px] font-semibold text-foreground">
              No calls scheduled
            </div>
            <p className="text-[13.5px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Click &ldquo;Schedule a meeting&rdquo; to book a Google Meet call with the AI Partner team.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                expanded={expandedTranscript === m.id}
                onToggleTranscript={() =>
                  setExpandedTranscript(expandedTranscript === m.id ? null : m.id)
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-semibold text-foreground">Past calls</h2>
            <Badge variant="outline">{past.length}</Badge>
          </div>
          <div className="space-y-4">
            {past.map((m) => (
              <MeetingCard
                key={m.id}
                m={m}
                muted
                expanded={expandedTranscript === m.id}
                onToggleTranscript={() =>
                  setExpandedTranscript(expandedTranscript === m.id ? null : m.id)
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MeetingCard({
  m,
  muted,
  expanded,
  onToggleTranscript,
}: {
  m: MeetingItem;
  muted?: boolean;
  expanded: boolean;
  onToggleTranscript: () => void;
}) {
  const status = STATUS_BADGE[m.status] ?? STATUS_BADGE.SCHEDULED;
  const transcriptStatus = TRANSCRIPT_STATUS[m.transcriptStatus] ?? TRANSCRIPT_STATUS.PENDING;
  const start = new Date(m.startsAt);
  const end = new Date(m.endsAt);
  const when = start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: m.timeZone || undefined,
  });
  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  const hasTranscript = m.transcriptStatus === "READY" && !!m.transcript;

  return (
    <Card
      variant="flat"
      padding="lg"
      className={cn(
        "customer-panel transition-colors hover:border-line-strong",
        muted && "opacity-75",
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Date / status row */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px]", status.cls)}>
              {m.status === "SCHEDULED" ? <CalendarClock className="h-3 w-3 mr-1" /> : m.status === "CANCELLED" ? <XCircle className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
            <span className="text-[12px] font-mono text-muted-foreground">
              {when} · {durationMin}m · {m.timeZone}
            </span>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <h3 className="text-[16px] font-semibold text-foreground truncate">
              {m.title}
            </h3>

            {m.agenda && (
              <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
                {m.agenda}
              </p>
            )}
          </div>

          {/* Organizer */}
          <div className="flex items-center gap-2 flex-wrap text-[12px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {m.organizerName ?? m.organizerEmail ?? "AI Partner Team"}
            </span>
          </div>

          {/* Transcript section */}
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className={cn("text-[10px]", transcriptStatus.cls)}>
              <FileText className="h-3 w-3 mr-1" />
              {transcriptStatus.label}
            </Badge>
            {hasTranscript && (
              <button
                type="button"
                onClick={onToggleTranscript}
                className="text-[12px] text-primary hover:text-primary/80 underline-offset-2 hover:underline"
              >
                {expanded ? "Hide transcript" : "View transcript"}
              </button>
            )}
          </div>

          {expanded && hasTranscript && (
            <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-4 max-h-80 overflow-y-auto">
              <pre className="text-[13px] whitespace-pre-wrap text-foreground/80 font-sans leading-relaxed">
                {m.transcript}
              </pre>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {m.meetLink && m.status === "SCHEDULED" && (
            <Button asChild size="sm">
              <a href={m.meetLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-3.5 w-3.5 mr-1.5" />
                Join
              </a>
            </Button>
          )}
          {m.googleHtmlLink && (
            <Button asChild size="sm" variant="outline">
              <a href={m.googleHtmlLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Calendar
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
