import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getLeadForGoogler } from "@/lib/lead-query";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { CopyButton } from "@/components/copy-button";
import { LEAD_MILESTONES, leadMilestoneIndex } from "@/lib/lead-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/sign-in?next=/google/leads/${id}`);

  const lead = await getLeadForGoogler(id, session.user.id);
  if (!lead) notFound();

  const activeIdx = leadMilestoneIndex(lead.status);
  const inviteUrl = `/auth/sign-up?invite=${lead.inviteToken}&email=${encodeURIComponent(lead.customerEmail)}`;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <Link
          href="/google/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">
              {lead.companyName ?? lead.customerDomain}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {lead.customerEmail}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {lead.customerDomain}
              </span>
            </div>
          </div>
          <LeadStatusBadge status={lead.status} className="text-xs h-7 px-3" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-white p-6">
          <div className="text-sm font-semibold text-foreground">
            Customer journey
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 mb-5">
            Live progress — auto-updates as the customer moves through
            AI Partner.
          </p>

          <ol className="relative border-l border-border pl-5 space-y-5">
            {LEAD_MILESTONES.map((m, i) => {
              const reached = i <= activeIdx;
              const current = i === activeIdx;
              return (
                <li key={m.key} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[27px] grid h-4 w-4 place-items-center rounded-full border-2 bg-white",
                      reached
                        ? "border-primary"
                        : "border-border",
                    )}
                  >
                    {reached ? (
                      <CheckCircle2
                        className={cn(
                          "h-3 w-3",
                          current ? "text-primary animate-pulse" : "text-primary",
                        )}
                      />
                    ) : (
                      <Circle className="h-2 w-2 text-muted-foreground" />
                    )}
                  </span>
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      reached ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m.title}
                    {current && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {m.description}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Sidebar: claimed user + invite link + notes + email */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Customer account
            </div>
            {lead.claimedUser ? (
              <div className="mt-2 space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {lead.claimedUser.name ?? "Unnamed customer"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lead.claimedUser.email}
                </div>
                {lead.claimedUser.company && (
                  <div className="text-xs text-muted-foreground">
                    {lead.claimedUser.company.name}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-2">
                  <Clock className="h-3 w-3" />
                  Activated {formatDate(lead.claimedAt)}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground italic">
                Not claimed yet. Invite is valid until used.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 space-y-3">
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Invite link
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-2 font-mono text-[11px] break-all text-foreground">
              {inviteUrl}
            </div>
            <CopyButton value={inviteUrl} />
            <p className="text-[11px] text-muted-foreground">
              Share this if the customer didn&apos;t receive the email. It can only
              be used once.
            </p>
          </div>

          {lead.notes && (
            <div className="rounded-2xl border border-border bg-white p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Your notes
              </div>
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                {lead.notes}
              </p>
            </div>
          )}

          {lead.mockEmailBody && (
            <details className="rounded-2xl border border-border bg-white p-5 group">
              <summary className="cursor-pointer text-xs uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground transition-colors">
                Preview invite email
              </summary>
              <pre className="mt-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-mono">
                {lead.mockEmailBody}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

