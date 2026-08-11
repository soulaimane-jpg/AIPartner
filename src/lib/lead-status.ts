import type { LeadStatus } from "@/lib/enums";

/**
 * A lead's live status is derived from the customer's activity once they've
 * claimed the invite. We don't store every micro-transition — instead we compute
 * the highest milestone reached from the data the customer produces.
 */
export type LeadSnapshot = {
  claimed: boolean;
  hasBrief: boolean;
  briefSubmitted: boolean; // stage beyond INTAKE
  matchedCount: number;
  proposalCount: number;
  meetingScheduled: boolean;
  selectedProposal: boolean;
};

export function deriveLeadStatus(snap: LeadSnapshot): LeadStatus {
  if (snap.selectedProposal) return "WON";
  if (snap.meetingScheduled) return "MEETING_SCHEDULED";
  if (snap.proposalCount > 0) return "PROPOSAL_RECEIVED";
  if (snap.matchedCount > 0) return "MATCHED";
  if (snap.briefSubmitted) return "BRIEF_SUBMITTED";
  if (snap.hasBrief) return "BRIEF_STARTED";
  if (snap.claimed) return "CLAIMED";
  return "INVITED";
}

/** Ordered progress milestones shown on the Googler's lead detail page. */
export const LEAD_MILESTONES: {
  key: LeadStatus;
  title: string;
  description: string;
}[] = [
  { key: "INVITED", title: "Invite sent", description: "Customer received their invite email." },
  { key: "CLAIMED", title: "Account created", description: "Customer activated their AI Partner account." },
  { key: "BRIEF_STARTED", title: "Discovery started", description: "Customer began drafting their SoW." },
  { key: "BRIEF_SUBMITTED", title: "SoW submitted", description: "Brief was pushed into sourcing / review." },
  { key: "MATCHED", title: "Partners matched", description: "Vetted GCP partners were matched to the brief." },
  { key: "PROPOSAL_RECEIVED", title: "Proposals received", description: "Partners sent back formal proposals." },
  { key: "MEETING_SCHEDULED", title: "Meeting scheduled", description: "Discovery or selection meeting on the calendar." },
  { key: "WON", title: "Partner selected", description: "Customer selected a partner — revenue in motion." },
];

export function leadMilestoneIndex(status: LeadStatus): number {
  const i = LEAD_MILESTONES.findIndex((m) => m.key === status);
  return i === -1 ? 0 : i;
}
