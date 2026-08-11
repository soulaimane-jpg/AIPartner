import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/enums";

const LABELS: Record<LeadStatus, string> = {
  INVITED: "Invited",
  CLAIMED: "Account created",
  BRIEF_STARTED: "SoW in progress",
  BRIEF_SUBMITTED: "SoW submitted",
  MATCHED: "Partners matched",
  PROPOSAL_RECEIVED: "Proposals in",
  MEETING_SCHEDULED: "Meeting scheduled",
  WON: "Partner selected",
  LOST: "Lost",
};

const TONES: Record<LeadStatus, string> = {
  INVITED: "bg-secondary text-muted-foreground border-border",
  CLAIMED: "bg-primary/10 text-primary border-primary/20",
  BRIEF_STARTED: "bg-primary/10 text-primary border-primary/20",
  BRIEF_SUBMITTED: "bg-primary/15 text-primary border-primary/25",
  MATCHED: "bg-warning/10 text-warning border-warning/20",
  PROPOSAL_RECEIVED: "bg-warning/15 text-warning border-warning/25",
  MEETING_SCHEDULED: "bg-success/10 text-success border-success/20",
  WON: "bg-success text-white border-success",
  LOST: "bg-destructive/10 text-destructive border-destructive/20",
};

export function LeadStatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        TONES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
