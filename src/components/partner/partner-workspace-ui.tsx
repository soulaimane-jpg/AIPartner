import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FolderOpen,
  MapPin,
  Sparkles,
  Trophy,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { PartnerPortalItem } from "@/lib/partner-portal";
import {
  getPartnerOpportunityAction,
  getPartnerStatusLabel,
  isPartnerActionRequired,
} from "@/lib/partner-workflow";

export function PartnerPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="portal-page-header">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {eyebrow}
        </div>
        <h1 className="portal-page-title text-balance">{title}</h1>
        <p className="portal-page-description text-pretty">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function PartnerMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  tone?: "blue" | "amber" | "emerald" | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  }[tone];

  const content = (
    <Card
      className={cn(
        "h-full overflow-hidden border-line bg-card shadow-elev-1",
        href && "group transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elev-2",
      )}
    >
      <CardContent className="flex h-full items-start gap-4 p-5 sm:p-6">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", styles)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {label}
            </p>
            {href && (
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            )}
          </div>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.025em] text-foreground">
            {value}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {content}
    </Link>
  ) : (
    content
  );
}

export function PartnerOpportunityList({
  items,
  emptyTitle,
  emptyDescription,
  emptyAction,
  compact = false,
}: {
  items: PartnerPortalItem[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; href: string };
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <PartnerEmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <PartnerOpportunityCard key={item.id} item={item} compact={compact} />
      ))}
    </div>
  );
}

export function PartnerOpportunityCard({
  item,
  compact = false,
}: {
  item: PartnerPortalItem;
  compact?: boolean;
}) {
  const status = getPartnerStatusLabel(item.matchStatus, item.proposalStatus);
  const actionRequired = isPartnerActionRequired(item.matchStatus, item.proposalStatus);
  const selected = status === "Selected";
  const deadline = getRelevantDeadline(item);
  const summary = item.anonymizedCompanySummary || item.executiveSummary;

  return (
    <Card className="group overflow-hidden border-line bg-card shadow-elev-1 transition-all hover:border-line-strong hover:shadow-elev-2">
      <CardContent className={cn("p-5 sm:p-6", compact && "sm:p-5")}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                  actionRequired && "border-amber-200 bg-amber-50 text-amber-800",
                  selected && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  !actionRequired && !selected && "border-blue-100 bg-blue-50 text-blue-700",
                )}
              >
                {actionRequired && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
                {status}
              </Badge>
              {item.matchScore != null && (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {item.matchScore}% match
                </span>
              )}
              <span className="text-[11.5px] text-muted-foreground">
                Updated {formatDistanceToNowStrict(item.updatedAt, { addSuffix: true })}
              </span>
            </div>

            <Link
              href={`/partner/briefs/${item.briefId}`}
              className="mt-3 block w-fit max-w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h2 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-[18px]">
                {item.briefTitle}
              </h2>
            </Link>

            {!compact && summary && (
              <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                {summary}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
              {item.preferredLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.preferredLocation}
                </span>
              )}
              {item.budgetRange && (
                <span className="inline-flex items-center gap-1.5">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  {item.budgetRange}
                </span>
              )}
              {item.proposalTimelineWeeks && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {item.proposalTimelineWeeks} weeks
                </span>
              )}
              {item.proposalTotalCost != null && (
                <span className="font-medium text-foreground">
                  {formatCurrency(item.proposalTotalCost)}
                </span>
              )}
              {deadline && <PartnerDeadline deadline={deadline} />}
            </div>

            {item.briefServices.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.briefServices.slice(0, compact ? 3 : 5).map((service) => (
                  <Badge key={service} variant="secondary" className="rounded-md px-2 py-0.5 text-[10.5px] font-medium">
                    {humanizeService(service)}
                  </Badge>
                ))}
                {item.briefServices.length > (compact ? 3 : 5) && (
                  <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[10.5px] font-medium">
                    +{item.briefServices.length - (compact ? 3 : 5)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Button asChild variant={actionRequired ? "default" : "outline"} className="h-10 shrink-0 rounded-lg px-4 xl:self-center">
            <Link href={`/partner/briefs/${item.briefId}`}>
              {getPartnerOpportunityAction(item.matchStatus, item.proposalStatus)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PartnerPipelineSection({
  title,
  description,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  items: PartnerPortalItem[];
  icon: LucideIcon;
  tone: "blue" | "amber" | "emerald";
}) {
  const style = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <section aria-labelledby={`pipeline-${tone}`} className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg border", style)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id={`pipeline-${tone}`} className="text-[15px] font-semibold text-foreground">
              {title}
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </div>
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <PartnerOpportunityList
          items={items}
          emptyTitle=""
          emptyDescription=""
          compact
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-surface-sunk px-5 py-7 text-[12.5px] text-muted-foreground">
          Nothing in this stage right now.
        </div>
      )}
    </section>
  );
}

export function PartnerEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <Card variant="inset" className="border-dashed shadow-none">
      <CardContent className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-card text-muted-foreground shadow-elev-1">
          <FolderOpen className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        {action && (
          <Button asChild variant="outline" className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export const partnerMetricIcons = {
  opportunities: BriefcaseBusiness,
  action: Clock3,
  pipeline: FileCheck2,
  won: Trophy,
  complete: CheckCircle2,
};

function PartnerDeadline({ deadline }: { deadline: Date }) {
  const delta = deadline.getTime() - Date.now();
  const expired = delta <= 0;
  const urgent = delta > 0 && delta <= 24 * 60 * 60 * 1000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        expired && "text-destructive",
        urgent && "text-amber-700",
      )}
    >
      <Clock3 className="h-3.5 w-3.5" />
      {expired ? "Deadline passed" : `Due ${format(deadline, "MMM d, HH:mm")}`}
    </span>
  );
}

function getRelevantDeadline(item: PartnerPortalItem): Date | null {
  if (item.matchStatus === "INVITED") return item.acceptDeadlineAt;
  if (
    item.matchStatus === "PARTNER_ACCEPTED" ||
    item.matchStatus === "EXTENSION_REQUESTED" ||
    item.proposalStatus === "DRAFT" ||
    item.proposalStatus === "CLARIFICATION_NEEDED" ||
    item.proposalStatus === "INTERNALLY_APPROVED"
  ) {
    return item.proposalDeadlineAt;
  }
  return null;
}

function humanizeService(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
