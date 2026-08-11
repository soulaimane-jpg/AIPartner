import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PartnerOpportunityList,
  PartnerPageHeader,
} from "@/components/partner/partner-workspace-ui";
import { getPartnerWorkspaceData } from "@/lib/partner-portal";

export const dynamic = "force-dynamic";

export default async function PartnerOpportunitiesPage() {
  const workspace = await getPartnerWorkspaceData();
  const responseNeeded = workspace.opportunities.filter(
    (item) => item.matchStatus === "INVITED",
  ).length;

  return (
    <div className="page-container-wide portal-page py-7 sm:py-9 lg:py-10">
      <PartnerPageHeader
        eyebrow="Opportunities"
        title="New customer matches"
        description="Review fit, understand why you were matched, and decide which opportunities your team can serve well."
        action={
          <Button asChild variant="outline" className="h-10 bg-card">
            <Link href="/partner/profile">
              Improve match profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCell
          label="Available"
          value={workspace.opportunities.length}
          detail="Open matches"
        />
        <SummaryCell
          label="Response needed"
          value={responseNeeded}
          detail="Invitation decisions"
          urgent={responseNeeded > 0}
        />
        <SummaryCell
          label="Profile strength"
          value={`${workspace.company.profileCompletion}%`}
          detail="Used to improve fit"
        />
      </section>

      <Card className="border-blue-100 bg-blue-50/60 shadow-none">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-blue-100 bg-white text-blue-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-blue-950">Customer identity stays protected</h2>
            <p className="mt-0.5 max-w-3xl text-[12px] leading-relaxed text-blue-800">
              Opportunity details are anonymized until the customer completes selection and the reveal gate opens.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Available now</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Ordered by the latest matching activity.</p>
          </div>
          <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
            {workspace.opportunities.length} {workspace.opportunities.length === 1 ? "match" : "matches"}
          </span>
        </div>
        <PartnerOpportunityList
          items={workspace.opportunities}
          emptyTitle="No new opportunities right now"
          emptyDescription="Your profile remains active. We'll notify your lead-routing contact as soon as a well-fitting customer brief is assigned."
          emptyAction={{ label: "Review company profile", href: "/partner/profile" }}
        />
      </section>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  detail,
  urgent = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  urgent?: boolean;
}) {
  return (
    <Card className="border-line bg-card shadow-elev-1">
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={urgent ? "text-[26px] font-semibold leading-none text-amber-700" : "text-[26px] font-semibold leading-none text-foreground"}>
            {value}
          </p>
          <p className="text-[11.5px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
