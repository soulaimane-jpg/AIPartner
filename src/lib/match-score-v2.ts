/**
 * Tag-based partner matching.
 *
 * ## Why this replaces the string-overlap scorer
 *
 * The original `computeMatch` intersected lowercased free text:
 * `intersect(brief.services, profile.specializations)`. Because both sides were
 * unconstrained prose written months apart by different people, the hit rate was
 * near zero — a brief asking for "data warehouse migration" never matched a
 * partner claiming "Data Warehouse Modernization". Scores were effectively noise
 * dressed up as precision.
 *
 * Matching on canonical tag ids removes that failure mode entirely: both sides
 * resolve through the same synonym-aware library, so equality is meaningful.
 *
 * ## Two additions beyond overlap
 *
 * **Substantiation.** The recurring worry about this design is that every
 * partner claims every capability. A tag alone is a claim; a tag plus a case
 * study or IP asset in the same area is evidence. Claimed-only tags score at
 * `CLAIM_WEIGHT` of a substantiated one, so breadth without depth stops paying.
 *
 * **Hard gates.** Some mismatches are disqualifying rather than merely weak. A
 * partner with a $100k floor is not a "62% fit" for a $20k pilot — they are
 * unavailable. Compliance requirements behave the same way. Gates are reported
 * separately from the score so a human sees *why* rather than just a low number.
 *
 * Pure and dependency-free so it can run in a Server Component.
 */

import { BENCH_AVAILABILITY_OPTIONS, DEAL_SIZE_OPTIONS } from "@/lib/partner-pillars";

/** Fraction of full credit a claimed-but-unevidenced tag earns. */
const CLAIM_WEIGHT = 0.55;

export interface MatchWeights {
  workloads: number;
  verticals: number;
  specializations: number;
  compliance: number;
  products: number;
  capacity: number;
}

/**
 * Workloads dominate because they describe the actual work. Products are a weak
 * signal — naming BigQuery says little about whether you can run a migration.
 */
export const DEFAULT_WEIGHTS: MatchWeights = {
  workloads: 0.32,
  verticals: 0.18,
  specializations: 0.20,
  compliance: 0.12,
  products: 0.08,
  capacity: 0.10,
};

/** What a brief is looking for, in canonical tag ids. */
export interface BriefRequirements {
  workloadTagIds: string[];
  verticalTagIds: string[];
  specializationTagIds: string[];
  /** Treated as hard requirements — a gap disqualifies. */
  complianceTagIds: string[];
  productTagIds: string[];
  /** DEAL_SIZE_OPTIONS value, or null when the budget is unstated. */
  budgetBand: string | null;
  /** BENCH_AVAILABILITY_OPTIONS value the client needs to start within. */
  urgency: string | null;
}

/** A partner's structured claims, in canonical tag ids. */
export interface PartnerCapabilities {
  workloadTagIds: string[];
  verticalTagIds: string[];
  specializationTagIds: string[];
  complianceTagIds: string[];
  productTagIds: string[];
  minDealSize: string | null;
  benchAvailability: string | null;
  /**
   * Tag ids the partner has real evidence for — derived from case-study and
   * IP-asset text by `deriveSubstantiatedTagIds`.
   */
  substantiatedTagIds: string[];
  /** Feeds the tie-break only; never the score itself. */
  profileStrength: number;
  /** Drives the staleness penalty. */
  lastVerifiedAt: Date | null;
  /**
   * Delivered outcomes on past briefs. Null (or thin) means "no
   * signal", which is neutral — never a penalty. See
   * `scorePerformance`.
   */
  performance?: PartnerPerformance | null;
}

/**
 * What the platform has actually observed about a partner, as opposed
 * to what the partner claims. Populated by
 * `@/lib/partner-performance` from win/loss, NPS and deal reports.
 */
export interface PartnerPerformance {
  /** Won / submitted, over the lookback window. Null when none submitted. */
  winRate: number | null;
  /** Mean NPS 0–10 for engagements involving this partner. */
  csat: number | null;
  /** Proposals submitted — the denominator behind `winRate`. */
  proposalsSubmitted: number;
  /** NPS responses behind `csat`. */
  csatResponses: number;
  /** Deals confirmed delivered. */
  dealsWon: number;
}

export type GateReason =
  | "budget_below_minimum"
  | "cannot_start_in_time"
  | "missing_required_compliance";

export interface MatchComponent {
  score: number;
  matchedSubstantiated: string[];
  matchedClaimed: string[];
  missing: string[];
}

export interface MatchResultV2 {
  score: number;
  label: "Excellent" | "Strong" | "Fair" | "Weak" | "Poor";
  /** True when no hard gate failed. */
  eligible: boolean;
  gates: GateReason[];
  reasons: string[];
  components: {
    workloads: MatchComponent;
    verticals: MatchComponent;
    specializations: MatchComponent;
    compliance: MatchComponent;
    products: MatchComponent;
    capacity: { score: number; note: string };
  };
  /** Bounded track-record adjustment applied to the final score. */
  performance: { multiplier: number; note: string | null };
}

const DEAL_SIZE_ORDER = DEAL_SIZE_OPTIONS.map((o) => o.value);
const BENCH_ORDER = BENCH_AVAILABILITY_OPTIONS.map((o) => o.value);

function rank(order: readonly string[], value: string | null): number {
  if (!value) return -1;
  return order.indexOf(value);
}

/**
 * Score one facet, weighting substantiated matches above bare claims.
 *
 * When a brief specifies nothing for a facet, a partner with relevant depth
 * still earns partial credit — but capped, because we are guessing.
 */
function scoreFacet(
  required: string[],
  claimed: string[],
  substantiated: Set<string>,
): MatchComponent {
  const claimedSet = new Set(claimed);

  if (required.length === 0) {
    return {
      score: claimed.length > 0 ? 45 : 0,
      matchedSubstantiated: [],
      matchedClaimed: [],
      missing: [],
    };
  }

  const matchedSubstantiated: string[] = [];
  const matchedClaimed: string[] = [];
  const missing: string[] = [];

  for (const id of required) {
    if (!claimedSet.has(id)) {
      missing.push(id);
    } else if (substantiated.has(id)) {
      matchedSubstantiated.push(id);
    } else {
      matchedClaimed.push(id);
    }
  }

  const credit =
    matchedSubstantiated.length + matchedClaimed.length * CLAIM_WEIGHT;
  return {
    score: Math.round((credit / required.length) * 100),
    matchedSubstantiated,
    matchedClaimed,
    missing,
  };
}

/**
 * Capacity fit from deal size and start date.
 *
 * Self-declared and unverifiable, so it carries the smallest weight of any
 * component. Included because a plausible-looking match that cannot start for
 * six weeks wastes everyone's time.
 */
function scoreCapacity(
  brief: BriefRequirements,
  partner: PartnerCapabilities,
): { score: number; note: string } {
  const parts: number[] = [];
  const notes: string[] = [];

  if (brief.budgetBand && partner.minDealSize) {
    const need = rank(DEAL_SIZE_ORDER, brief.budgetBand);
    const floor = rank(DEAL_SIZE_ORDER, partner.minDealSize);
    if (need >= floor) {
      parts.push(100);
      notes.push("Budget fits their engagement size");
    } else {
      // Gated elsewhere; scored low here so an ungated near-miss still ranks
      // below a clean fit.
      parts.push(0);
      notes.push("Below their typical project size");
    }
  }

  if (brief.urgency && partner.benchAvailability) {
    const needed = rank(BENCH_ORDER, brief.urgency);
    const actual = rank(BENCH_ORDER, partner.benchAvailability);
    if (actual <= needed) {
      parts.push(100);
      notes.push("Can start in your timeframe");
    } else {
      parts.push(25);
      notes.push("Slower to start than requested");
    }
  }

  if (parts.length === 0) {
    return { score: 50, note: "Capacity not stated" };
  }
  return {
    score: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length),
    note: notes.join("; "),
  };
}

/**
 * Hard gates.
 *
 * Kept separate from scoring on purpose. Folding these into the number would
 * produce a "45% match" that a human might still click, when the correct
 * message is "this partner cannot take this work".
 */
function evaluateGates(
  brief: BriefRequirements,
  partner: PartnerCapabilities,
): GateReason[] {
  const gates: GateReason[] = [];

  if (brief.budgetBand && partner.minDealSize) {
    if (
      rank(DEAL_SIZE_ORDER, brief.budgetBand) <
      rank(DEAL_SIZE_ORDER, partner.minDealSize)
    ) {
      gates.push("budget_below_minimum");
    }
  }

  if (brief.urgency && partner.benchAvailability) {
    if (
      rank(BENCH_ORDER, partner.benchAvailability) >
      rank(BENCH_ORDER, brief.urgency)
    ) {
      gates.push("cannot_start_in_time");
    }
  }

  // Compliance is regulatory, not preferential. A partner who has never
  // delivered under HIPAA is not a weaker HIPAA option — they are not an option.
  if (brief.complianceTagIds.length > 0) {
    const held = new Set(partner.complianceTagIds);
    if (brief.complianceTagIds.some((id) => !held.has(id))) {
      gates.push("missing_required_compliance");
    }
  }

  return gates;
}

/**
 * Track-record adjustment — the platform's own observations feeding
 * back into ranking.
 *
 * Deliberately a bounded multiplier rather than a weighted component:
 *
 *   - **Bounded** (±10%). Past performance should break ties between
 *     comparable partners, never override capability fit. A partner who
 *     matches the actual requirements must not lose to a weaker fit
 *     with a prettier history.
 *   - **Smoothed toward neutral.** Rates are pulled toward 50% in
 *     proportion to how little data supports them (a Bayesian prior
 *     with weight `PRIOR_STRENGTH`), so one lucky win doesn't mint a
 *     top-ranked partner and one loss doesn't bury a new one.
 *   - **Never a cold-start penalty.** No data → multiplier exactly 1.0.
 *     Otherwise the feedback loop becomes a rich-get-richer ratchet
 *     that new partners can never escape, which is both unfair and
 *     bad for marketplace liquidity.
 */
const PERFORMANCE_SWING = 0.1;
const PRIOR_STRENGTH = 5;

export function scorePerformance(
  performance: PartnerPerformance | null | undefined,
): { multiplier: number; note: string | null } {
  if (!performance) return { multiplier: 1, note: null };

  const signals: number[] = [];

  if (performance.proposalsSubmitted > 0 && performance.winRate !== null) {
    // Smooth toward a 0.5 prior; weight grows with sample size.
    const n = performance.proposalsSubmitted;
    const smoothed =
      (performance.winRate * n + 0.5 * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
    signals.push(smoothed);
  }

  if (performance.csatResponses > 0 && performance.csat !== null) {
    const n = performance.csatResponses;
    const normalised = performance.csat / 10;
    const smoothed =
      (normalised * n + 0.5 * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
    signals.push(smoothed);
  }

  if (signals.length === 0) return { multiplier: 1, note: null };

  const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
  // mean 0.5 → 1.0; mean 1 → 1 + SWING; mean 0 → 1 - SWING.
  const multiplier = 1 + (mean - 0.5) * 2 * PERFORMANCE_SWING;

  const parts: string[] = [];
  if (performance.dealsWon > 0) {
    parts.push(
      `${performance.dealsWon} delivered engagement${performance.dealsWon === 1 ? "" : "s"}`,
    );
  }
  if (performance.csat !== null && performance.csatResponses >= 3) {
    parts.push(`${performance.csat.toFixed(1)}/10 customer satisfaction`);
  }

  return {
    multiplier,
    note:
      parts.length > 0
        ? `Track record: ${parts.join(", ")}`
        : multiplier >= 1
          ? "Track record slightly above average"
          : "Track record slightly below average",
  };
}

/** Days since verification, or null when never verified. */
function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function computeMatchV2(
  brief: BriefRequirements,
  partner: PartnerCapabilities,
  {
    weights = DEFAULT_WEIGHTS,
    now = new Date(),
  }: { weights?: MatchWeights; now?: Date } = {},
): MatchResultV2 {
  const substantiated = new Set(partner.substantiatedTagIds);

  const components = {
    workloads: scoreFacet(
      brief.workloadTagIds,
      partner.workloadTagIds,
      substantiated,
    ),
    verticals: scoreFacet(
      brief.verticalTagIds,
      partner.verticalTagIds,
      substantiated,
    ),
    specializations: scoreFacet(
      brief.specializationTagIds,
      partner.specializationTagIds,
      substantiated,
    ),
    compliance: scoreFacet(
      brief.complianceTagIds,
      partner.complianceTagIds,
      substantiated,
    ),
    products: scoreFacet(
      brief.productTagIds,
      partner.productTagIds,
      substantiated,
    ),
    capacity: scoreCapacity(brief, partner),
  };

  let score =
    components.workloads.score * weights.workloads +
    components.verticals.score * weights.verticals +
    components.specializations.score * weights.specializations +
    components.compliance.score * weights.compliance +
    components.products.score * weights.products +
    components.capacity.score * weights.capacity;

  // Staleness penalty. An unverified profile is a weaker claim than a recently
  // confirmed one, so it should not outrank it on identical tags.
  const age = daysSince(partner.lastVerifiedAt, now);
  if (age === null) score *= 0.9;
  else if (age > 365) score *= 0.85;
  else if (age > 183) score *= 0.93;

  // Feedback loop: what we've actually observed this partner deliver.
  const performance = scorePerformance(partner.performance);
  score *= performance.multiplier;

  const gates = evaluateGates(brief, partner);
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    label: labelFor(finalScore),
    eligible: gates.length === 0,
    gates,
    reasons: buildReasons(components, gates, age, performance.note),
    components,
    performance: {
      multiplier: performance.multiplier,
      note: performance.note,
    },
  };
}

function buildReasons(
  components: MatchResultV2["components"],
  gates: GateReason[],
  ageDays: number | null,
  performanceNote?: string | null,
): string[] {
  const reasons: string[] = [];

  const sub = components.workloads.matchedSubstantiated.length;
  if (sub > 0) {
    reasons.push(
      `${sub} required workload${sub === 1 ? "" : "s"} backed by delivered work`,
    );
  }
  const claimedOnly = components.workloads.matchedClaimed.length;
  if (claimedOnly > 0) {
    reasons.push(
      `${claimedOnly} workload${claimedOnly === 1 ? "" : "s"} claimed but not evidenced`,
    );
  }
  if (components.workloads.missing.length > 0) {
    reasons.push(
      `${components.workloads.missing.length} required workload${components.workloads.missing.length === 1 ? "" : "s"} not offered`,
    );
  }
  if (components.verticals.matchedSubstantiated.length > 0) {
    reasons.push("Delivered in your industry");
  }
  if (components.capacity.note) reasons.push(components.capacity.note);

  for (const gate of gates) {
    reasons.push(
      gate === "budget_below_minimum"
        ? "Project is below their minimum engagement size"
        : gate === "cannot_start_in_time"
          ? "Cannot mobilise within your timeframe"
          : "Missing a required compliance capability",
    );
  }

  if (performanceNote) reasons.push(performanceNote);

  if (ageDays === null) reasons.push("Profile not yet verified");
  else if (ageDays > 183) reasons.push("Profile not confirmed recently");

  return reasons;
}

function labelFor(score: number): MatchResultV2["label"] {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Fair";
  if (score >= 25) return "Weak";
  return "Poor";
}

// ─── Substantiation ───────────────────────────────────────────

/**
 * Work out which tags a partner has real evidence for.
 *
 * Matches each tag's label against the free text of their case studies and IP
 * assets. Text matching is crude, but the alternative — asking partners to link
 * each case study to specific tags — adds friction to the one part of the
 * profile we most want them to fill in.
 *
 * Deliberately conservative: a false negative just means a tag scores as a
 * claim, which is the safe direction. A false positive would let marketing copy
 * masquerade as evidence.
 */
export function deriveSubstantiatedTagIds(
  tags: { id: string; label: string }[],
  evidenceText: string[],
): string[] {
  const haystack = evidenceText
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
  if (!haystack.trim()) return [];

  const out: string[] = [];
  for (const tag of tags) {
    const label = tag.label.toLowerCase();
    // Very short labels ("SAP", "GKE") would false-positive inside unrelated
    // words, so they need a word-boundary match rather than a substring hit.
    const needle = label.replace(/\s*[–—-]\s*/g, " ").trim();
    if (needle.length < 4) {
      if (new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(haystack)) {
        out.push(tag.id);
      }
      continue;
    }
    if (haystack.includes(needle)) {
      out.push(tag.id);
      continue;
    }
    // Multi-word labels rarely appear verbatim ("Data Warehousing & Analytics"
    // vs. "data warehouse analytics work"). Require every significant word.
    const words = needle.split(/\s+/).filter((w) => w.length > 3);
    if (words.length >= 2 && words.every((w) => haystack.includes(w))) {
      out.push(tag.id);
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
