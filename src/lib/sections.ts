/**
 * Canonical section-key registry — plan-A F1 (§6.3 / §6.7).
 *
 * Single source of truth for the section keys shared by:
 *   - Brief creation (both AI and call paths) — `BriefSection.key`
 *   - Proposal builder — `ProposalSection.key`
 *   - Anonymization pipeline + comparison view rows
 *   - Clarification-thread anchors (`anchorSectionKey`)
 *
 * **Never rename a key** — they are persisted. Only append.
 * The brief→proposal mapping drives the comparison table: each
 * proposal section answers one or more brief sections, and the
 * comparison grid rows are the proposal keys.
 */

// ─── Brief sections (M3) ──────────────────────────────────────

export const BRIEF_SECTION_KEYS = [
  "context_and_goals",
  "scope",
  "current_environment",
  "technical_requirements",
  "timeline",
  "budget_band",
  "resell_interest",
  "success_criteria",
  "constraints",
  "other",
] as const;
export type BriefSectionKey = (typeof BRIEF_SECTION_KEYS)[number];

export interface SectionMeta {
  key: string;
  label: string;
  /** Shown under the section title in editors/review UIs. */
  hint: string;
  /** Mandatory sections are enforced at brief submission (M3). */
  mandatory: boolean;
  rank: number;
}

export const BRIEF_SECTIONS: Record<BriefSectionKey, SectionMeta> = {
  context_and_goals: {
    key: "context_and_goals",
    label: "Context & Goals",
    hint: "Why this project exists and what success unlocks for the business.",
    mandatory: true,
    rank: 10,
  },
  scope: {
    key: "scope",
    label: "Scope",
    hint: "What is in and out of scope. Concrete deliverables.",
    mandatory: true,
    rank: 20,
  },
  current_environment: {
    key: "current_environment",
    label: "Current Environment",
    hint: "Existing stack, cloud footprint, data sources, teams involved.",
    mandatory: true,
    rank: 30,
  },
  technical_requirements: {
    key: "technical_requirements",
    label: "Technical Requirements",
    hint: "Hard requirements: services, compliance, integrations, SLAs.",
    mandatory: true,
    rank: 40,
  },
  timeline: {
    key: "timeline",
    label: "Timeline",
    hint: "Target go-live, key milestones, immovable dates.",
    mandatory: true,
    rank: 50,
  },
  budget_band: {
    key: "budget_band",
    label: "Budget Band",
    hint: "Budget range or band. Bands are fine — precision isn't required.",
    mandatory: false,
    rank: 60,
  },
  resell_interest: {
    key: "resell_interest",
    label: "Resell Interest",
    hint: "Openness to procuring GCP via the partner (resell).",
    mandatory: false,
    rank: 70,
  },
  success_criteria: {
    key: "success_criteria",
    label: "Success Criteria",
    hint: "How the outcome will be measured and accepted.",
    mandatory: true,
    rank: 80,
  },
  constraints: {
    key: "constraints",
    label: "Constraints",
    hint: "Security, procurement, legal, staffing or vendor constraints.",
    mandatory: false,
    rank: 90,
  },
  other: {
    key: "other",
    label: "Other",
    hint: "Anything that doesn't fit the sections above.",
    mandatory: false,
    rank: 100,
  },
};

// ─── Proposal sections (M7) ───────────────────────────────────

export const PROPOSAL_SECTION_KEYS = [
  "approach",
  "scope_response",
  "timeline",
  "resources_team",
  "pricing",
  "assumptions",
  "references_anonymizable",
  "questions",
] as const;
export type ProposalSectionKey = (typeof PROPOSAL_SECTION_KEYS)[number];

/** Pricing models supported by the structured pricing section (M7.1). */
export const PRICING_MODELS = ["fixed", "tm", "tiered", "resell"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  fixed: "Fixed price",
  tm: "Time & materials",
  tiered: "Tiered",
  resell: "Resell terms",
};

export const PROPOSAL_SECTIONS: Record<ProposalSectionKey, SectionMeta> = {
  approach: {
    key: "approach",
    label: "Approach",
    hint: "How you would run this engagement end-to-end.",
    mandatory: true,
    rank: 10,
  },
  scope_response: {
    key: "scope_response",
    label: "Scope Response",
    hint: "Point-by-point response to the brief's scope.",
    mandatory: true,
    rank: 20,
  },
  timeline: {
    key: "timeline",
    label: "Timeline",
    hint: "Phases, milestones and duration in weeks.",
    mandatory: true,
    rank: 30,
  },
  resources_team: {
    key: "resources_team",
    label: "Resources & Team",
    hint: "Roles, seniority and allocation you'll commit.",
    mandatory: true,
    rank: 40,
  },
  pricing: {
    key: "pricing",
    label: "Pricing",
    hint: "Structured pricing with model options (fixed / T&M / tiered / resell).",
    mandatory: true,
    rank: 50,
  },
  assumptions: {
    key: "assumptions",
    label: "Assumptions",
    hint: "What your estimate assumes about the customer's environment.",
    mandatory: true,
    rank: 60,
  },
  references_anonymizable: {
    key: "references_anonymizable",
    label: "References",
    hint: "Relevant delivery references. Will be anonymized before the customer sees them.",
    mandatory: false,
    rank: 70,
  },
  questions: {
    key: "questions",
    label: "Questions",
    hint: "Open questions for the customer (routed via clarification threads).",
    mandatory: false,
    rank: 80,
  },
};

// ─── Helpers ──────────────────────────────────────────────────

export function isBriefSectionKey(key: string): key is BriefSectionKey {
  return (BRIEF_SECTION_KEYS as readonly string[]).includes(key);
}

export function isProposalSectionKey(key: string): key is ProposalSectionKey {
  return (PROPOSAL_SECTION_KEYS as readonly string[]).includes(key);
}

export function mandatoryBriefKeys(): BriefSectionKey[] {
  return BRIEF_SECTION_KEYS.filter((k) => BRIEF_SECTIONS[k].mandatory);
}

export function mandatoryProposalKeys(): ProposalSectionKey[] {
  return PROPOSAL_SECTION_KEYS.filter((k) => PROPOSAL_SECTIONS[k].mandatory);
}

/**
 * Map the legacy `ProjectBrief` columns onto canonical brief sections.
 * Used by the backfill script and by read paths that must render a
 * section view for briefs created before the registry existed.
 */
export function legacyBriefToSections(brief: {
  executiveSummary?: string | null;
  scopeRequirements?: string | null;
  dataSources?: string | null;
  integrationPoints?: string | null;
  targetGoLive?: string | null;
  milestones?: string | null;
  budgetRange?: string | null;
  budgetNotes?: string | null;
  successCriteria?: string | null;
  requiredCertifications?: string | null;
  legalTimeline?: string | null;
  procurement?: string | null;
}): Partial<Record<BriefSectionKey, string>> {
  const joinJson = (raw: string | null | undefined): string => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            typeof item === "string"
              ? item
              : item && typeof item === "object"
                ? Object.values(item as Record<string, unknown>)
                    .filter((v) => typeof v === "string")
                    .join(" — ")
                : "",
          )
          .filter(Boolean)
          .join("\n");
      }
      return String(parsed ?? "");
    } catch {
      return raw;
    }
  };

  const out: Partial<Record<BriefSectionKey, string>> = {};
  if (brief.executiveSummary) out.context_and_goals = brief.executiveSummary;
  const scope = joinJson(brief.scopeRequirements);
  if (scope) out.scope = scope;
  const env = [joinJson(brief.dataSources), joinJson(brief.integrationPoints)]
    .filter(Boolean)
    .join("\n");
  if (env) out.current_environment = env;
  const tech = joinJson(brief.requiredCertifications);
  if (tech) out.technical_requirements = tech;
  const timeline = [
    brief.targetGoLive ? `Target go-live: ${brief.targetGoLive}` : "",
    joinJson(brief.milestones),
  ]
    .filter(Boolean)
    .join("\n");
  if (timeline) out.timeline = timeline;
  const budget = [brief.budgetRange ?? "", brief.budgetNotes ?? ""]
    .filter(Boolean)
    .join("\n");
  if (budget) out.budget_band = budget;
  if (brief.procurement && brief.procurement !== "UNSURE") {
    out.resell_interest =
      brief.procurement === "VIA_RESELLER"
        ? "Open to procuring via a reseller partner."
        : "Currently procures directly from Google.";
  }
  const success = joinJson(brief.successCriteria);
  if (success) out.success_criteria = success;
  const constraints = brief.legalTimeline
    ? `Legal/procurement timeline: ${brief.legalTimeline}`
    : "";
  if (constraints) out.constraints = constraints;
  return out;
}
