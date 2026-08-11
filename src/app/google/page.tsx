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

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview · Google Portal" };

export default async function GooglerOverviewPage() {
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
    <GoogleShell className="space-y-8 pb-20">
      {/* Hero header — navy gradient banner with aurora + noise */}
      <GoogleSection>
        <div className="relative isolate overflow-hidden rounded-3xl bg-hero-purple text-white p-8 lg:p-10">
          <div aria-hidden className="bg-aurora" />
          <div aria-hidden className="bg-noise" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-magenta-1 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Google Sales Portal
              </div>
              <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-semibold tracking-[-0.018em] text-white mt-2">
                Welcome back, {session.user.name?.split(" ")[0] ?? "there"}.
              </h1>
              <p className="text-[14px] text-white/75 mt-2 max-w-xl">
                Refer customers into AI Partner and track their journey to a
                signed Google Cloud partner engagement.
              </p>
            </div>
            <Button asChild className="h-11 px-5" variant="pill-magenta" size="md">
              <Link href="/google/leads/new">
                <UserPlus className="h-4 w-4 mr-2" /> Refer a customer
              </Link>
            </Button>
          </div>
        </div>
      </GoogleSection>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="rounded-2xl border border-border bg-white overflow-hidden shadow-elev-1">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
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
                className="text-xs font-semibold text-magenta-1 hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {leads.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-border">
              {recent.map((l) => (
                <Link
                  key={l.id}
                  href={`/google/leads/${l.id}`}
                  className="flex flex-wrap items-center gap-4 px-6 py-4 hover:bg-secondary/40 transition-colors"
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
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-magenta-1/12 text-magenta-1">
        <UserPlus className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-foreground">
        No leads yet
      </div>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
        Submit your first lead — it takes about 30 seconds. They&apos;ll get an
        invite email and you&apos;ll see their progress here.
      </p>
      <Button asChild className="mt-4 h-10 px-5" variant="pill-magenta">
        <Link href="/google/leads/new">
          <UserPlus className="h-4 w-4 mr-2" /> Refer a customer
        </Link>
      </Button>
    </div>
  );
}
