import Link from "next/link";
import { redirect } from "next/navigation";
import {
  UserPlus,
  Sparkles,
  CheckCircle2,
  Hourglass,
  ArrowRight,
  Send,
  Users,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getGooglerLeads } from "@/lib/lead-query";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { timeAgo } from "@/lib/utils";
import { GoogleShell, GoogleSection, GoogleKpi } from "./google-shell";
import { requireGoogler } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · Google Portal" };

export default async function GooglerOverviewPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireGoogler();

  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/google");

  const leads = await getGooglerLeads(session.user.id);

  const totals = {
    total: leads.length,
    activated: leads.filter((l) => l.status !== "INVITED").length,
    withSow: leads.filter(
      (l) =>
        l.status === "BRIEF_STARTED" ||
        l.status === "BRIEF_SUBMITTED" ||
        l.status === "MATCHED" ||
        l.status === "PROPOSAL_RECEIVED" ||
        l.status === "MEETING_SCHEDULED" ||
        l.status === "WON",
    ).length,
    won: leads.filter((l) => l.status === "WON").length,
  };

  const recent = leads.slice(0, 6);

  return (
    <GoogleShell className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      {/* Hero header — navy gradient banner with aurora + noise */}
      <GoogleSection>
        <header className="portal-page-header">
          <div className="flex items-start gap-3">
            <span className="portal-icon-box" aria-hidden>
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="eyebrow text-primary">Google Sales Portal</div>
              <h1 className="portal-page-title">
                Welcome back, {session.user.name?.split(" ")[0] ?? "there"}.
              </h1>
              <p className="portal-page-description">
                Refer customers into AI Partner and track their journey to a
                signed Google Cloud partner engagement.
              </p>
            </div>
          </div>
          <Button asChild className="w-full sm:w-auto" size="default">
            <Link href="/google/leads/new">
              <UserPlus className="h-4 w-4" /> Refer a customer
            </Link>
          </Button>
        </header>
      </GoogleSection>

      {/* KPIs */}
      <div className="customer-kpi-grid">
        <GoogleKpi
          icon={<Send className="h-4 w-4" />}
          label="Leads referred"
          value={totals.total}
          tone="muted"
        />
        <GoogleKpi
          icon={<Users className="h-4 w-4" />}
          label="Accounts activated"
          value={totals.activated}
          tone="primary"
        />
        <GoogleKpi
          icon={<Hourglass className="h-4 w-4" />}
          label="SoWs in flight"
          value={totals.withSow}
          tone="warning"
        />
        <GoogleKpi
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Partners selected"
          value={totals.won}
          tone="success"
        />
      </div>

      {/* Recent leads */}
      <GoogleSection>
        <div className="customer-table">
          <div className="customer-panel-header">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Recent leads
              </div>
              <div className="text-xs text-muted-foreground">
                The 6 most recent customer referrals.
              </div>
            </div>
            {leads.length > 0 && (
              <Link
                href="/google/leads"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {leads.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-line">
              {recent.map((l) => (
                <Link
                  key={l.id}
                  href={`/google/leads/${l.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-primary/5 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {l.companyName ?? l.customerDomain}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {l.customerEmail}
                      {l.claimedUser?.name ? ` · ${l.claimedUser.name}` : ""}
                    </div>
                  </div>
                  <LeadStatusBadge status={l.status} />
                  <span className="text-xs text-muted-foreground min-w-[90px] text-right">
                    {timeAgo(l.invitedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </GoogleSection>
    </GoogleShell>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary text-primary">
        <UserPlus className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">
        No leads yet
      </div>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
        Submit your first lead — it takes about 30 seconds. They&apos;ll get an
        invite email and you&apos;ll see their progress here.
      </p>
      <Button asChild className="mt-4">
        <Link href="/google/leads/new">
          <UserPlus className="h-4 w-4 mr-2" /> Refer a customer
        </Link>
      </Button>
    </div>
  );
}
