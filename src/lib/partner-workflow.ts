export type PartnerWorkspaceBucket =
  | "opportunities"
  | "pipeline"
  | "won"
  | "closed";

export type PartnerPipelinePhase = "proposal" | "review" | "finalist";

const OPPORTUNITY_MATCH_STATES = new Set([
  "SOURCED",
  "INVITED",
  "REVIEW_APPROVED",
]);

const CLOSED_MATCH_STATES = new Set([
  "PARTNER_DECLINED",
  "DECLINED",
  "NOT_SELECTED",
  "EXPIRED",
  "PROPOSAL_EXPIRED",
  "WITHDRAWN",
]);

const WON_STATES = new Set(["SELECTED"]);

const FINALIST_STATES = new Set(["SHORTLISTED", "IN_FINAL_THREE"]);

const REVIEW_MATCH_STATES = new Set(["PROPOSAL_SUBMITTED", "QC_PASSED"]);

const REVIEW_PROPOSAL_STATES = new Set([
  "SUBMITTED",
  "IN_QC",
  "QC_PASSED",
]);

const PROPOSAL_ACTION_STATES = new Set([
  "DRAFT",
  "INTERNAL_REVIEW",
  "INTERNALLY_APPROVED",
  "CLARIFICATION_NEEDED",
]);

export function getPartnerWorkspaceBucket(
  matchStatus: string,
  proposalStatus: string | null,
): PartnerWorkspaceBucket {
  if (WON_STATES.has(matchStatus) || (proposalStatus && WON_STATES.has(proposalStatus))) {
    return "won";
  }

  if (
    CLOSED_MATCH_STATES.has(matchStatus) ||
    proposalStatus === "DECLINED"
  ) {
    return "closed";
  }

  if (
    OPPORTUNITY_MATCH_STATES.has(matchStatus) &&
    !proposalStatus
  ) {
    return "opportunities";
  }

  return "pipeline";
}

export function getPartnerPipelinePhase(
  matchStatus: string,
  proposalStatus: string | null,
): PartnerPipelinePhase {
  if (
    FINALIST_STATES.has(matchStatus) ||
    proposalStatus === "SHORTLISTED"
  ) {
    return "finalist";
  }

  if (
    REVIEW_MATCH_STATES.has(matchStatus) ||
    (proposalStatus && REVIEW_PROPOSAL_STATES.has(proposalStatus))
  ) {
    return "review";
  }

  return "proposal";
}

export function getPartnerStatusLabel(
  matchStatus: string,
  proposalStatus: string | null,
): string {
  if (matchStatus === "SELECTED" || proposalStatus === "SELECTED") return "Selected";
  if (matchStatus === "INVITED") return "Response needed";
  if (matchStatus === "SOURCED") return "New match";
  if (matchStatus === "REVIEW_APPROVED") return "Ready to review";
  if (proposalStatus === "CLARIFICATION_NEEDED") return "Changes requested";
  if (proposalStatus === "INTERNALLY_APPROVED") return "Ready to submit";
  if (matchStatus === "PARTNER_ACCEPTED") return "Proposal due";
  if (matchStatus === "EXTENSION_REQUESTED") return "Extension pending";
  if (matchStatus === "PROPOSAL_SUBMITTED") return "Submitted";
  if (matchStatus === "QC_PASSED") return "Quality approved";
  if (matchStatus === "SHORTLISTED" || proposalStatus === "SHORTLISTED") return "Shortlisted";
  if (matchStatus === "IN_FINAL_THREE") return "Finalist";
  if (proposalStatus === "IN_QC") return "Quality review";
  if (proposalStatus === "SUBMITTED") return "Submitted";
  if (proposalStatus === "INTERNAL_REVIEW") return "Internal review";
  if (proposalStatus === "DRAFT") return "Draft proposal";
  if (matchStatus === "PROPOSAL_EXPIRED") return "Proposal expired";
  if (matchStatus === "EXPIRED") return "Invite expired";
  if (matchStatus === "PARTNER_DECLINED" || matchStatus === "DECLINED") return "Declined";
  if (matchStatus === "NOT_SELECTED" || proposalStatus === "DECLINED") return "Not selected";
  if (matchStatus === "WITHDRAWN") return "Withdrawn";
  return humanizePartnerStatus(proposalStatus || matchStatus);
}

export function getPartnerOpportunityAction(
  matchStatus: string,
  proposalStatus: string | null,
): string {
  const bucket = getPartnerWorkspaceBucket(matchStatus, proposalStatus);
  if (bucket === "won") return "Open engagement";
  if (matchStatus === "INVITED") return "Review and respond";
  if (matchStatus === "SOURCED" || matchStatus === "REVIEW_APPROVED") return "Review opportunity";
  if (proposalStatus === "CLARIFICATION_NEEDED") return "Update proposal";
  if (
    matchStatus === "PARTNER_ACCEPTED" ||
    matchStatus === "EXTENSION_REQUESTED" ||
    PROPOSAL_ACTION_STATES.has(proposalStatus || "")
  ) {
    return "Continue proposal";
  }
  return "View details";
}

export function isPartnerActionRequired(
  matchStatus: string,
  proposalStatus: string | null,
): boolean {
  return (
    matchStatus === "INVITED" ||
    matchStatus === "PARTNER_ACCEPTED" ||
    proposalStatus === "DRAFT" ||
    proposalStatus === "CLARIFICATION_NEEDED" ||
    proposalStatus === "INTERNALLY_APPROVED"
  );
}

function humanizePartnerStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
