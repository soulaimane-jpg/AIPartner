import { FilePenLine, Send, UsersRound } from "lucide-react";
import {
  PartnerEmptyState,
  PartnerPageHeader,
  PartnerPipelineSection,
} from "@/components/partner/partner-workspace-ui";
import { getPartnerWorkspaceData } from "@/lib/partner-portal";

export const dynamic = "force-dynamic";

export default async function PartnerPipelinePage() {
  const workspace = await getPartnerWorkspaceData();

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <PartnerPageHeader
        eyebrow="Pipeline"
        title="Proposals in motion"
        description="One place for every accepted opportunity, from the first proposal draft through customer selection."
      />

      {workspace.pipeline.length === 0 ? (
        <PartnerEmptyState
          title="Your pipeline is clear"
          description="Accept a new opportunity to start a proposal. It will move through drafting, review, and finalist stages here."
          action={{ label: "Browse opportunities", href: "/partner/opportunities" }}
        />
      ) : (
        <div className="space-y-9">
          <PartnerPipelineSection
            title="Proposal work"
            description="Drafts, requested changes, and submissions your team is preparing."
            items={workspace.pipelineByPhase.proposal}
            icon={FilePenLine}
            tone="amber"
          />
          <PartnerPipelineSection
            title="Under review"
            description="Submitted proposals moving through quality and customer review."
            items={workspace.pipelineByPhase.review}
            icon={Send}
            tone="blue"
          />
          <PartnerPipelineSection
            title="Finalists"
            description="Shortlisted opportunities in the last stage of customer selection."
            items={workspace.pipelineByPhase.finalist}
            icon={UsersRound}
            tone="emerald"
          />
        </div>
      )}
    </div>
  );
}
