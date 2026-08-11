import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Mail, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PartnerMetricCard,
  PartnerOpportunityList,
  PartnerPageHeader,
  partnerMetricIcons,
} from "@/components/partner/partner-workspace-ui";
import { getPartnerWorkspaceData } from "@/lib/partner-portal";
import { loadPartnerPillarState } from "@/lib/partner-pillar-load";
import { OnboardingBanner } from "@/components/partner/onboarding-banner";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab === "pipeline") redirect("/partner/pipeline");
  if (tab === "won") redirect("/partner/won");
  if (tab === "inbox") redirect("/partner/opportunities");

  const workspace = await getPartnerWorkspaceData();
  const pillarState = await loadPartnerPillarState(workspace.company.id);
  const firstName = workspace.user.name.trim().split(/\s+/)[0] || workspace.company.name;
  const recent = [...workspace.opportunities, ...workspace.pipeline, ...workspace.won]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  // "Welcome back" to somebody who has never been here is a small thing that
  // makes the whole product feel unattended. First-run gets its own copy.
  const isFirstRun =
    !pillarState.onboardingCompleted && workspace.items.length === 0;

  return (
    <div className="page-container-wide portal-page py-7 sm:py-9 lg:py-10">
      {/* Header */}
      <PartnerPageHeader
        eyebrow="Partner workspace"
        title={
          isFirstRun
            ? `Welcome, ${firstName}.`
            : `Welcome back, ${firstName}.`
        }
        description={
          isFirstRun
            ? "Complete your capability profile so we can start matching you to customer briefs that fit."
            : "Prioritize new matches, move proposals forward, and keep your company ready for the next customer."
        }
        action={
          <Button asChild variant="outline" className="h-10 bg-card">
            <Link href="/partner/profile">
              <Settings2 className="h-4 w-4" />
              Company profile
            </Link>
          </Button>
        }
      />

      {!pillarState.onboardingCompleted && (
        <OnboardingBanner
          score={pillarState.strength.score}
          nextBestAction={pillarState.strength.nextBestAction}
          missingRequiredCount={pillarState.strength.missingRequired.length}
        />
      )}

      {/* Lead-routing email nudge */}
      {!workspace.company.leadRoutingEmail && (
        <Card className="border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-200 bg-white text-amber-700">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-amber-950">Choose where new opportunities should arrive</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                  Add a shared lead-routing email so the right team sees every invitation.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
              <Link href="/partner/profile">Add routing email</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile + KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Profile card */}
        <PartnerMetricCard
          label="New opportunities"
          value={workspace.opportunities.length}
          detail="Matches awaiting review"
          icon={partnerMetricIcons.opportunities}
          href="/partner/opportunities"
          tone="blue"
        />
        {/* Company info */}
        <PartnerMetricCard
          label="Needs action"
          value={workspace.actionRequired.length}
          detail="Responses or proposal updates"
          icon={partnerMetricIcons.action}
          href={workspace.opportunities.length > 0 ? "/partner/opportunities" : "/partner/pipeline"}
          tone="amber"
        />
        {/* KPI grid */}
        <PartnerMetricCard
          label="Active pipeline"
          value={workspace.pipeline.length}
          detail="Proposals moving forward"
          icon={partnerMetricIcons.pipeline}
          href="/partner/pipeline"
          tone="slate"
        />
        <PartnerMetricCard
          label="Selected"
          value={workspace.won.length}
          detail="Customer-selected engagements"
          icon={partnerMetricIcons.won}
          href="/partner/won"
          tone="emerald"
        />
      </section>

      {/* Side cards */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.75fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Action center</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">The highest-priority work your team owns now.</p>
            </div>
            {workspace.actionRequired.length > 3 && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/partner/pipeline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            )}
          </div>
          <PartnerOpportunityList
            items={workspace.actionRequired.slice(0, 3)}
            emptyTitle="You're all caught up"
            emptyDescription="There are no invitations or proposal changes waiting on your team. We'll surface the next action here."
          />
        </div>

        <Card className="h-fit border-line bg-card shadow-elev-1">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                <Building2 className="h-[18px] w-[18px]" />
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {workspace.company.gcpTier || workspace.company.tier || "Member"}
              </span>
            </div>
            <h2 className="mt-5 text-[17px] font-semibold tracking-tight text-foreground">{workspace.company.name}</h2>
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {workspace.company.tagline || "Add a concise company tagline to strengthen how your team appears in matching."}
            </p>
            <div className="mt-5 flex items-center justify-between text-[11.5px]">
              <span className="font-medium text-foreground">Profile strength</span>
              <span className="font-semibold tabular-nums text-primary">{pillarState.strength.score}%</span>
            </div>
            <Progress value={pillarState.strength.score} className="mt-2 h-1.5" />
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              {pillarState.strength.nextBestAction ??
                "Every pillar is complete. Clients see your full capability picture."}
            </p>
            {pillarState.freshness.label && (
              <p className="mt-2 text-[11px] font-medium text-emerald-700">
                {pillarState.freshness.label}
              </p>
            )}
            <Button asChild variant="outline" className="mt-5 w-full bg-card">
              <Link href="/partner/profile">Improve profile <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Tabs / Brief list */}
      <section className="space-y-4 border-t border-line pt-7">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent work</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">The latest opportunities and proposal activity across your workspace.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/partner/pipeline">Open pipeline <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <PartnerOpportunityList
          items={recent}
          emptyTitle="Your workspace is ready"
          emptyDescription="New customer matches will appear here as soon as they are assigned to your company."
          emptyAction={{ label: "Complete company profile", href: "/partner/profile" }}
          compact
        />
      </section>
    </div>
  );
}
