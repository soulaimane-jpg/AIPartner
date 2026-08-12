/**
 * Identity firewall — plan-A §8 Layer 1 (structural).
 *
 * Golden rules 1 & 2: pre-reveal, no partner-facing payload contains
 * company-identifying fields and no company-facing payload contains
 * partner-identifying fields. Enforced here at the serialization
 * layer — every partner/company-facing read builds its DTO through
 * these allow-list serializers, never by spreading raw database rows.
 *
 * Layer 3 (process): the reveal is a single explicit, logged event
 * per lead. `isRevealActive()` + `isPartnerRevealed()` are the only
 * gates that may flip serializer behaviour — and only for SELECTED
 * partners on that lead. Not-selected partners stay firewalled
 * forever.
 *
 * `assertFirewallSafe()` recursively scans any payload for forbidden
 * keys — used by the blocking test suite and available as a dev-time
 * belt-and-braces check on new endpoints.
 */

import type { LeadState } from "@/lib/state-machine/lead";

// ─── Reveal gates ─────────────────────────────────────────────

/** Lead states at/after the reveal event (§5.1). */
const REVEALED_LEAD_STATES: readonly string[] = [
  "REVEAL_APPROVED",
  "MEETINGS_SCHEDULED",
  "COMPLETED",
  "DROPPED_OFF",
];

/** Match states meaning "this partner was selected by the company". */
const SELECTED_MATCH_STATES: readonly string[] = [
  "SELECTED",
  // Legacy flows marked selection on the proposal — callers pass
  // proposalStatus for those rows.
  "IN_FINAL_THREE",
];

/** Has the lead-level reveal event happened? */
export function isRevealActive(leadState: string | LeadState): boolean {
  return REVEALED_LEAD_STATES.includes(leadState);
}

/**
 * Is identity revealed between the company and THIS partner?
 * Both conditions must hold: the lead passed the reveal gate AND this
 * specific partner was selected.
 */
export function isPartnerRevealed(opts: {
  leadState: string;
  matchStatus: string;
  proposalStatus?: string | null;
}): boolean {
  if (!isRevealActive(opts.leadState)) return false;
  return (
    SELECTED_MATCH_STATES.includes(opts.matchStatus) ||
    opts.proposalStatus === "SELECTED"
  );
}

// ─── Forbidden-field deny lists (for assertions/tests) ────────

/**
 * Keys that must NEVER appear in a partner-facing payload pre-reveal
 * (company-identifying data).
 */
export const FORBIDDEN_FOR_PARTNER = [
  "companyName",
  "customerName",
  "customerEmail",
  "ownerEmail",
  "ownerName",
  "linkedinUrl",
  "websiteUrl",
  "rawProfile",
  "decisionMakers",
  // Company contractual data is admin-only even post-reveal (§10).
  "gcpDiscountPct",
  "gcpContractEndDate",
  "gcpAgreementStatus",
] as const;

/**
 * Keys that must NEVER appear in a company-facing payload pre-reveal
 * (partner-identifying data).
 */
export const FORBIDDEN_FOR_COMPANY = [
  "partnerName",
  "partnerWebsite",
  "logoUrl",
  "directoryUrl",
  "leadRoutingEmail",
  "headquarters",
  "keyClients",
  "partnerContacts",
  "outreachEmail",
] as const;

export type FirewallAudience = "partner" | "company";

export class FirewallViolationError extends Error {
  constructor(
    public readonly audience: FirewallAudience,
    public readonly path: string,
  ) {
    super(
      `Identity-firewall violation: forbidden field "${path}" in ${audience}-facing payload (plan-A §8)`,
    );
    this.name = "FirewallViolationError";
  }
}

/**
 * Recursively assert a payload contains none of the forbidden keys
 * for its audience. Throws `FirewallViolationError` on the first hit.
 */
export function assertFirewallSafe(
  payload: unknown,
  audience: FirewallAudience,
  path = "$",
): void {
  const forbidden: readonly string[] =
    audience === "partner" ? FORBIDDEN_FOR_PARTNER : FORBIDDEN_FOR_COMPANY;

  if (payload == null || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertFirewallSafe(item, audience, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (forbidden.includes(key) && value != null && value !== "") {
      throw new FirewallViolationError(audience, `${path}.${key}`);
    }
    assertFirewallSafe(value, audience, `${path}.${key}`);
  }
}

// ─── Partner-facing serializers ───────────────────────────────

export interface PartnerFacingBrief {
  briefId: string;
  title: string;
  /** Admin-written anonymized company summary (§8 L2). */
  anonymizedCompanySummary: string | null;
  services: string;
  executiveSummary: string | null;
  scopeRequirements: string;
  successCriteria: string;
  milestones: string;
  budgetRange: string | null;
  preferredLocation: string | null;
  requiredCertifications: string;
  industryExperience: string;
  targetGoLive: string | null;
  /** Post-reveal only — null while firewalled. */
  companyName: string | null;
  companyWebsite: string | null;
}

/**
 * Build the partner-facing brief DTO. Allow-list construction: fields
 * are copied one by one; company identity appears ONLY when
 * `revealed` (i.e. `isPartnerRevealed()` returned true for this
 * partner's match).
 */
export function serializePartnerFacingBrief(
  brief: {
    id: string;
    title: string;
    anonymizedCompanySummary?: string | null;
    services: string;
    executiveSummary: string | null;
    scopeRequirements: string;
    successCriteria: string;
    milestones: string;
    budgetRange: string | null;
    preferredLocation: string | null;
    requiredCertifications: string;
    industryExperience: string;
    targetGoLive: string | null;
    company?: { name: string; website: string | null } | null;
  },
  opts: { revealed: boolean },
): PartnerFacingBrief {
  return {
    briefId: brief.id,
    title: brief.title,
    anonymizedCompanySummary: brief.anonymizedCompanySummary ?? null,
    services: brief.services,
    executiveSummary: brief.executiveSummary,
    scopeRequirements: brief.scopeRequirements,
    successCriteria: brief.successCriteria,
    milestones: brief.milestones,
    budgetRange: brief.budgetRange,
    preferredLocation: brief.preferredLocation,
    requiredCertifications: brief.requiredCertifications,
    industryExperience: brief.industryExperience,
    targetGoLive: brief.targetGoLive,
    companyName: opts.revealed ? (brief.company?.name ?? null) : null,
    companyWebsite: opts.revealed ? (brief.company?.website ?? null) : null,
  };
}

// ─── Company-facing serializers ───────────────────────────────

export interface CompanyFacingProposalColumn {
  proposalId: string;
  matchId: string;
  /** "Partner A", "Partner B", … — the ONLY identity pre-reveal. */
  displayLabel: string;
  submittedFirst: boolean;
  submissionRank: number | null;
  summary: string;
  approach: string;
  timelineWeeks: number;
  totalCost: number;
  status: string;
  strengths: string[];
  team: { role: string; seniority?: string; count?: number }[];
  /** Anonymized tier badge is allowed (non-identifying). */
  tier: string | null;
  /** Post-reveal only — null while firewalled. */
  revealedPartnerName: string | null;
  revealedTagline: string | null;
}

/**
 * Build a company-facing proposal column. Pre-reveal the partner is
 * identified ONLY by the stable placeholder label; identity fields
 * populate exclusively when `revealed` (selected partner + reveal
 * event on the lead).
 */
export interface CompanyFacingShortlistCard {
  matchId: string;
  /** "Partner A", "Partner B", … — the ONLY identity pre-reveal. */
  displayLabel: string;
  status: string;
  acceptedAt: string | null;
  customerPriority: number | null;
  /** Coarse delivery regions — non-identifying, unlike an HQ address. */
  regions: string[];
  languages: string[];
  specializations: string[];
  expertiseAreas: string[];
  /** Anonymized tier badge is allowed (non-identifying). */
  gcpTier: string | null;
  certifications: { name: string; count?: number; level?: string }[];
  /**
   * Case studies stripped of the title and link pre-reveal — both
   * routinely name the partner or its clients.
   */
  caseStudies: { industry: string | null; summary: string | null; title: string | null; link: string | null }[];
  /** Post-reveal only — null while firewalled. */
  revealedPartnerName: string | null;
  revealedTagline: string | null;
  revealedHeadquarters: string | null;
  revealedOfficeLocations: string[];
}

/**
 * Build a company-facing shortlist card. The customer compares
 * partners on capability alone until the reveal event; identity
 * (name, tagline, HQ, offices, case-study titles/links) populates
 * exclusively when `revealed`.
 */
export function serializeCompanyFacingShortlistCard(
  input: {
    match: {
      id: string;
      status: string;
      placeholderLabel: string | null;
      acceptedTermsAt: Date | null;
      customerPriority: number | null;
    };
    partner?: { name: string; tagline?: string | null } | null;
    profile?: {
      headquarters?: string | null;
      officeLocations?: string[];
      regions?: string[];
      languages?: string[];
      specializations?: string[];
      expertiseAreas?: string[];
      gcpTier?: string | null;
      certifications?: { name: string; count?: number; level?: string }[];
      caseStudies?: {
        title?: string;
        industry?: string;
        summary?: string;
        link?: string;
      }[];
    } | null;
    fallbackIndex: number;
  },
  opts: { revealed: boolean },
): CompanyFacingShortlistCard {
  const label =
    input.match.placeholderLabel ??
    `Partner ${String.fromCharCode(65 + input.fallbackIndex)}`;
  const profile = input.profile ?? {};

  return {
    matchId: input.match.id,
    displayLabel:
      opts.revealed && input.partner ? input.partner.name : label,
    status: input.match.status,
    acceptedAt: input.match.acceptedTermsAt?.toISOString() ?? null,
    customerPriority: input.match.customerPriority,
    regions: profile.regions ?? [],
    languages: profile.languages ?? [],
    specializations: profile.specializations ?? [],
    expertiseAreas: profile.expertiseAreas ?? [],
    gcpTier: profile.gcpTier ?? null,
    certifications: profile.certifications ?? [],
    caseStudies: (profile.caseStudies ?? []).map((cs) => ({
      industry: cs.industry ?? null,
      summary: cs.summary ?? null,
      title: opts.revealed ? (cs.title ?? null) : null,
      link: opts.revealed ? (cs.link ?? null) : null,
    })),
    revealedPartnerName:
      opts.revealed && input.partner ? input.partner.name : null,
    revealedTagline:
      opts.revealed && input.partner ? (input.partner.tagline ?? null) : null,
    revealedHeadquarters: opts.revealed ? (profile.headquarters ?? null) : null,
    revealedOfficeLocations: opts.revealed ? (profile.officeLocations ?? []) : [],
  };
}

export function serializeCompanyFacingProposal(
  input: {
    proposal: {
      id: string;
      summary: string | null;
      approach: string | null;
      timelineWeeks: number | null;
      totalCost: number | null;
      status: string;
      strengths: string | null;
      teamComposition: string | null;
      submittedAt: Date | null;
    };
    match: {
      id: string;
      placeholderLabel: string | null;
      status: string;
    };
    partner?: { name: string; tagline?: string | null; tier?: string | null } | null;
    submissionRank?: number | null;
    fallbackIndex: number;
  },
  opts: { revealed: boolean },
): CompanyFacingProposalColumn {
  const label =
    input.match.placeholderLabel ??
    `Partner ${String.fromCharCode(65 + input.fallbackIndex)}`;

  const safeParse = <T>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    proposalId: input.proposal.id,
    matchId: input.match.id,
    displayLabel: opts.revealed && input.partner ? input.partner.name : label,
    submittedFirst: input.submissionRank === 1,
    submissionRank: input.submissionRank ?? null,
    summary: input.proposal.summary ?? "",
    approach: input.proposal.approach ?? "",
    timelineWeeks: input.proposal.timelineWeeks ?? 0,
    totalCost: input.proposal.totalCost ?? 0,
    status: input.proposal.status,
    strengths: safeParse<string[]>(input.proposal.strengths, []),
    team: safeParse<{ role: string; seniority?: string; count?: number }[]>(
      input.proposal.teamComposition,
      [],
    ),
    tier: input.partner?.tier ?? null,
    revealedPartnerName:
      opts.revealed && input.partner ? input.partner.name : null,
    revealedTagline:
      opts.revealed && input.partner ? (input.partner.tagline ?? null) : null,
  };
}
