import { CircleDollarSign, Trophy } from "lucide-react";
import {
  PartnerMetricCard,
  PartnerOpportunityList,
  PartnerPageHeader,
  partnerMetricIcons,
} from "@/components/partner/partner-workspace-ui";
import { getPartnerWorkspaceData } from "@/lib/partner-portal";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PartnerWonPage() {
  const workspace = await getPartnerWorkspaceData();
  const selectedValue = workspace.won.reduce(
    (total, item) => total + (item.proposalTotalCost ?? 0),
    0,
  );
  const withReportedValue = workspace.won.filter(
    (item) => item.proposalTotalCost != null,
  ).length;

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <PartnerPageHeader
        eyebrow="Selected"
        title="Won engagements"
        description="Track customer-selected proposals and keep engagement outcomes current as each relationship develops."
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <PartnerMetricCard
          label="Selected engagements"
          value={workspace.won.length}
          detail="Customer-selected proposals"
          icon={partnerMetricIcons.won}
          tone="emerald"
        />
        <PartnerMetricCard
          label="Submitted proposal value"
          value={withReportedValue > 0 ? formatCurrency(selectedValue) : "—"}
          detail={withReportedValue > 0 ? `Across ${withReportedValue} priced proposals` : "No proposal value recorded"}
          icon={CircleDollarSign}
          tone="blue"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Engagements</h2>
            <p className="text-[12.5px] text-muted-foreground">Open an engagement to report NDA, deal, or drop-off status.</p>
          </div>
        </div>
        <PartnerOpportunityList
          items={workspace.won}
          emptyTitle="No selected engagements yet"
          emptyDescription="When a customer selects your proposal, the engagement will appear here with outcome reporting and next steps."
          emptyAction={{ label: "View active pipeline", href: "/partner/pipeline" }}
        />
      </section>
    </div>
  );
}
