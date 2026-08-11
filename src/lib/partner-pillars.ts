/**
 * Canonical partner-profile field registry — the 5-Pillar Blueprint.
 *
 * Single source of truth for the structured intake schema shared by:
 *   - The guided onboarding wizard (`/partner/onboarding`)
 *   - The ongoing profile editor (`/partner/profile`)
 *   - Server-side validation (Zod schemas are generated from this)
 *   - Profile-strength scoring
 *   - The match engine
 *   - Admin partner views
 *
 * **Never rename a field key** — they are persisted on `PartnerProfile`
 * columns and in `PartnerTag.facet`. Only append.
 *
 * Design intent (see the August 2026 feedback):
 *   Structured micro-inputs — tags, segmented buttons, sliders, short
 *   numeric fields — instead of open text. Partner time drops from
 *   30–45 min to 3–5 min and the data becomes comparable across partners.
 */

// ─── Pillars ──────────────────────────────────────────────────

export const PILLAR_KEYS = [
  "positioning",
  "ip_accelerators",
  "commercials",
  "operations",
  "proof",
] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];

export interface PillarMeta {
  key: PillarKey;
  label: string;
  /** One-line framing shown at the top of the wizard step. */
  hint: string;
  /** Wizard step order. */
  rank: number;
}

export const PILLARS: Record<PillarKey, PillarMeta> = {
  positioning: {
    key: "positioning",
    label: "Capabilities & Positioning",
    hint: "Where you win. Platforms, workloads, and the verticals you know cold.",
    rank: 10,
  },
  ip_accelerators: {
    key: "ip_accelerators",
    label: "IP & Accelerators",
    hint: "The assets you bring on day one that others have to build from scratch.",
    rank: 20,
  },
  commercials: {
    key: "commercials",
    label: "Commercials & Pricing",
    hint: "How you engage and what a realistic entry project looks like.",
    rank: 30,
  },
  operations: {
    key: "operations",
    label: "Operations & Capacity",
    hint: "How fast you can start and who actually shows up.",
    rank: 40,
  },
  proof: {
    key: "proof",
    label: "Proof & Outcomes",
    hint: "Evidence. Numbers you have hit and references you can stand behind.",
    rank: 50,
  },
};

export function pillarsInOrder(): PillarMeta[] {
  return Object.values(PILLARS).sort((a, b) => a.rank - b.rank);
}

// ─── Tag facets ───────────────────────────────────────────────
//
// A facet is a namespace within the tag library. `Tag.facet` +
// `Tag.slug` is unique, so "security" can exist as both a workload
// and a vertical without colliding.

export const TAG_FACETS = [
  "platform",
  "workload",
  "vertical",
  "compliance",
  "product",
  "asset_category",
  "engagement_model",
  "collaboration",
  "metric",
  "specialization",
] as const;
export type TagFacet = (typeof TAG_FACETS)[number];

export function isTagFacet(value: string): value is TagFacet {
  return (TAG_FACETS as readonly string[]).includes(value);
}

// ─── Field controls ───────────────────────────────────────────

export type FieldControl =
  /** Async multi-select over a tag facet, with "+ Suggest a tag". */
  | "tags"
  /** Single-choice pill row backed by a fixed option list. */
  | "segmented"
  /** Multi-choice pill row backed by a fixed option list. */
  | "multi"
  /** 0–100 split slider (e.g. senior vs. junior ratio). */
  | "ratio"
  /** Two bounded numbers forming a range (e.g. 15%–30%). */
  | "range"
  /** Short free text with a hard character cap. */
  | "text"
  /** Repeating structured record (IP assets, case studies). */
  | "repeater";

export interface FieldOption {
  value: string;
  label: string;
  /** Optional clarifier shown under the label. */
  hint?: string;
}

export interface FieldMeta {
  key: string;
  pillar: PillarKey;
  label: string;
  hint: string;
  control: FieldControl;
  /** Persisted column on `PartnerProfile`, or the `PartnerTag.facet`. */
  column: string;
  /** For `control: "tags"` — which facet the picker searches. */
  facet?: TagFacet;
  /** For `segmented` / `multi` — the fixed option list. */
  options?: readonly FieldOption[];
  /**
   * Cap on selections. The feedback's core worry is that every partner
   * claims everything; caps are the cheapest structural defence.
   */
  maxSelections?: number;
  /** Hard cap for `text` controls — forces signal over marketing fluff. */
  charLimit?: number;
  /**
   * Contribution to profile strength (0–100 across all fields).
   * Weight reflects buyer value, not effort.
   */
  weight: number;
  /** Blocks wizard completion when true. */
  required: boolean;
  rank: number;
}

// ─── Fixed option lists ───────────────────────────────────────
//
// These are closed sets — unlike tags, they are not partner-extensible,
// because their whole value is that every partner answers on the same
// scale. Changing an option value is a migration.

export const ASSET_ACCESS_OPTIONS = [
  { value: "handed_over", label: "Handed over to client" },
  { value: "proprietary", label: "Proprietary internal tooling" },
  { value: "open_source", label: "Open source" },
] as const;

export const ASSET_IMPACT_OPTIONS = [
  { value: "speed", label: "Speeds up time-to-deploy" },
  { value: "cost", label: "Reduces cloud spend" },
  { value: "compliance", label: "Guarantees compliance / security" },
] as const;

export const ENGAGEMENT_MODEL_OPTIONS = [
  { value: "time_materials", label: "Time & Materials" },
  { value: "fixed_price", label: "Fixed-Price SOW" },
  { value: "outcome", label: "Outcome / Milestone" },
  {
    value: "gain_share",
    label: "FinOps Gain-Share",
    hint: "% of verified savings",
  },
  { value: "retainer", label: "Monthly Retainer" },
] as const;

export const DEAL_SIZE_OPTIONS = [
  { value: "under_25k", label: "< $25k" },
  { value: "25k_50k", label: "$25k – $50k" },
  { value: "50k_100k", label: "$50k – $100k" },
  { value: "over_100k", label: "$100k+" },
] as const;

export const POC_OFFERING_OPTIONS = [
  { value: "fixed_fee", label: "Fixed-fee pilot" },
  { value: "complimentary", label: "Complimentary / co-funded" },
  { value: "custom", label: "Custom / no standard" },
] as const;

export const BENCH_AVAILABILITY_OPTIONS = [
  { value: "immediate", label: "Immediate", hint: "< 7 days" },
  { value: "1_2_weeks", label: "1–2 weeks" },
  { value: "2_4_weeks", label: "2–4 weeks" },
  { value: "1_month_plus", label: "1 month+" },
] as const;

export const COLLABORATION_OPTIONS = [
  {
    value: "embedded",
    label: "Embedded / co-development",
    hint: "Working directly in the client's repo",
  },
  { value: "managed", label: "Fully managed delivery" },
  { value: "advisory", label: "Advisory only" },
] as const;

export const REFERENCE_AVAILABILITY_OPTIONS = [
  { value: "direct_calls", label: "Yes — direct 1-on-1 calls" },
  { value: "written", label: "Yes — written case studies" },
  { value: "nda_restricted", label: "NDA restricted" },
] as const;

// ─── The field registry ───────────────────────────────────────

export const PILLAR_FIELDS: Record<string, FieldMeta> = {
  // ── Pillar 1: Capabilities & Positioning ──────────────────
  platforms: {
    key: "platforms",
    pillar: "positioning",
    label: "Primary cloud platforms",
    hint: "Where your team has real production depth.",
    control: "tags",
    column: "platform",
    facet: "platform",
    maxSelections: 4,
    weight: 4,
    required: true,
    rank: 110,
  },
  specializations: {
    key: "specializations",
    pillar: "positioning",
    label: "Google Cloud specializations",
    hint: "Official specializations you hold. These are verified against the partner directory.",
    control: "tags",
    column: "specialization",
    facet: "specialization",
    maxSelections: 8,
    weight: 10,
    required: false,
    rank: 120,
  },
  workloads: {
    key: "workloads",
    pillar: "positioning",
    label: "Core workload strengths",
    hint: "Pick the work you would bet a fixed-price SOW on — not everything you can spell.",
    control: "tags",
    column: "workload",
    facet: "workload",
    maxSelections: 6,
    weight: 12,
    required: true,
    rank: 130,
  },
  verticals: {
    key: "verticals",
    pillar: "positioning",
    label: "Micro-vertical focus",
    hint: "Industries where you have shipped, not just pitched.",
    control: "tags",
    column: "vertical",
    facet: "vertical",
    maxSelections: 6,
    weight: 8,
    required: true,
    rank: 140,
  },
  compliance: {
    key: "compliance",
    pillar: "positioning",
    label: "Compliance & regulatory expertise",
    hint: "Frameworks you have delivered against under audit.",
    control: "tags",
    column: "compliance",
    facet: "compliance",
    maxSelections: 6,
    weight: 6,
    required: false,
    rank: 150,
  },
  products: {
    key: "products",
    pillar: "positioning",
    label: "Product & tooling depth",
    hint: "Specific services: BigQuery, Vertex AI, Anthos, Apigee…",
    control: "tags",
    column: "product",
    facet: "product",
    maxSelections: 20,
    weight: 5,
    required: false,
    rank: 160,
  },

  // ── Pillar 2: IP & Accelerators ───────────────────────────
  ipAssets: {
    key: "ipAssets",
    pillar: "ip_accelerators",
    label: "Pre-built assets & accelerators",
    hint: 'Name the asset and the time it saves — e.g. "Terraform Landing Zone Kit — 3 weeks to 2 days".',
    control: "repeater",
    column: "ipAssets",
    charLimit: 300,
    weight: 12,
    required: false,
    rank: 210,
  },
  assetCategories: {
    key: "assetCategories",
    pillar: "ip_accelerators",
    label: "Asset categories",
    hint: "The broad shape of the IP you bring.",
    control: "tags",
    column: "asset_category",
    facet: "asset_category",
    maxSelections: 8,
    weight: 4,
    required: false,
    rank: 220,
  },
  resellPlatforms: {
    key: "resellPlatforms",
    pillar: "ip_accelerators",
    label: "Additional technology offered",
    hint: "Third-party platforms you resell or bundle — cost optimization, observability, governance.",
    control: "text",
    column: "resellPlatforms",
    charLimit: 300,
    weight: 3,
    required: false,
    rank: 230,
  },

  // ── Pillar 3: Commercials & Pricing ───────────────────────
  engagementModels: {
    key: "engagementModels",
    pillar: "commercials",
    label: "Engagement models offered",
    hint: "Only pick models you will actually sign. Clients will hold you to these.",
    control: "multi",
    column: "engagementModels",
    options: ENGAGEMENT_MODEL_OPTIONS,
    maxSelections: 3,
    weight: 8,
    required: true,
    rank: 310,
  },
  minDealSize: {
    key: "minDealSize",
    pillar: "commercials",
    label: "Typical entry project size",
    hint: "The smallest engagement that makes commercial sense for you.",
    control: "segmented",
    column: "minDealSize",
    options: DEAL_SIZE_OPTIONS,
    weight: 8,
    required: true,
    rank: 320,
  },
  typicalContractMonths: {
    key: "typicalContractMonths",
    pillar: "commercials",
    label: "Typical contract duration",
    hint: "Months, for a representative engagement.",
    control: "range",
    column: "typicalContractMonths",
    weight: 4,
    required: false,
    rank: 330,
  },
  pocOffering: {
    key: "pocOffering",
    pillar: "commercials",
    label: "Proof-of-concept offering",
    hint: "Standardized pilots are a strong differentiator — buyers can compare them directly.",
    control: "segmented",
    column: "pocOffering",
    options: POC_OFFERING_OPTIONS,
    weight: 6,
    required: false,
    rank: 340,
  },

  // ── Pillar 4: Operations & Capacity ───────────────────────
  benchAvailability: {
    key: "benchAvailability",
    pillar: "operations",
    label: "Time-to-deploy a team",
    hint: "Realistic lead time from signature to people working.",
    control: "segmented",
    column: "benchAvailability",
    options: BENCH_AVAILABILITY_OPTIONS,
    weight: 7,
    required: true,
    rank: 410,
  },
  seniorityRatio: {
    key: "seniorityRatio",
    pillar: "operations",
    label: "Team seniority mix",
    hint: "Share of senior/lead architects on a typical engagement.",
    control: "ratio",
    column: "seniorityRatio",
    weight: 4,
    required: false,
    rank: 420,
  },
  collaborationStyles: {
    key: "collaborationStyles",
    pillar: "operations",
    label: "Collaboration style",
    hint: "How you prefer to work alongside a client team.",
    control: "multi",
    column: "collaborationStyles",
    options: COLLABORATION_OPTIONS,
    maxSelections: 2,
    weight: 4,
    required: false,
    rank: 430,
  },

  // ── Pillar 5: Proof & Outcomes ────────────────────────────
  caseStudies: {
    key: "caseStudies",
    pillar: "proof",
    label: "Case studies",
    hint: "Dates matter more than logos. Note whether a confidential reference is possible.",
    control: "repeater",
    column: "caseStudies",
    weight: 14,
    required: false,
    rank: 510,
  },
  metricTypes: {
    key: "metricTypes",
    pillar: "proof",
    label: "Verifiable impact areas",
    hint: "The kinds of outcome you can evidence with numbers.",
    control: "tags",
    column: "metric",
    facet: "metric",
    maxSelections: 6,
    weight: 5,
    required: false,
    rank: 520,
  },
  valueRanges: {
    key: "valueRanges",
    pillar: "proof",
    label: "Typical value delivered",
    hint: "Ranges you have actually achieved, not best-case.",
    control: "range",
    column: "valueRanges",
    weight: 6,
    required: false,
    rank: 530,
  },
  referenceAvailability: {
    key: "referenceAvailability",
    pillar: "proof",
    label: "Client references",
    hint: "Willingness to put a client on a call is the strongest signal you can give.",
    control: "segmented",
    column: "referenceAvailability",
    options: REFERENCE_AVAILABILITY_OPTIONS,
    weight: 8,
    required: false,
    rank: 540,
  },
};

export const PILLAR_FIELD_KEYS = Object.keys(PILLAR_FIELDS);

// ─── Lookups ──────────────────────────────────────────────────

export function isPillarFieldKey(value: string): boolean {
  return Object.hasOwn(PILLAR_FIELDS, value);
}

export function fieldsForPillar(pillar: PillarKey): FieldMeta[] {
  return Object.values(PILLAR_FIELDS)
    .filter((f) => f.pillar === pillar)
    .sort((a, b) => a.rank - b.rank);
}

/** Every field backed by the tag library, in render order. */
export function tagFields(): (FieldMeta & { facet: TagFacet })[] {
  return Object.values(PILLAR_FIELDS)
    .filter((f): f is FieldMeta & { facet: TagFacet } =>
      f.control === "tags" && Boolean(f.facet),
    )
    .sort((a, b) => a.rank - b.rank);
}

/** Fields that block wizard completion. */
export function requiredFieldKeys(): string[] {
  return Object.values(PILLAR_FIELDS)
    .filter((f) => f.required)
    .sort((a, b) => a.rank - b.rank)
    .map((f) => f.key);
}

/**
 * Total weight across the registry. Profile strength is
 * `earned / TOTAL_FIELD_WEIGHT * 100`, so this must stay the
 * denominator rather than a hardcoded 100.
 */
export const TOTAL_FIELD_WEIGHT = Object.values(PILLAR_FIELDS).reduce(
  (sum, f) => sum + f.weight,
  0,
);
