import "server-only";

/**
 * Builds `computeMatchV2` inputs from the database.
 *
 * Kept separate from the scorer so the scoring logic stays pure and unit-
 * testable without a database, and so batch callers can load many partners in
 * one round-trip rather than N.
 */

import { query, queryOne } from "@/lib/db";
import type {
  CompanyRow,
  PartnerProfileRow,
  ProjectBriefRow,
} from "@/lib/db/rows";
import { computeMatch, type MatchBreakdown } from "@/lib/match-score";
import { loadPartnerPerformance } from "@/lib/partner-performance";
import {
  computeMatchV2,
  deriveSubstantiatedTagIds,
  type BriefRequirements,
  type GateReason,
  type PartnerCapabilities,
} from "@/lib/match-score-v2";
import type { TagFacet } from "@/lib/partner-pillars";
import { resolveTag } from "@/lib/tags";
import { safeJsonParse } from "@/lib/utils";

/**
 * Resolve a brief's free-text requirements onto canonical tag ids.
 *
 * Briefs are still authored as prose, so this is the bridge. Using the same
 * synonym-aware resolver the partner side uses is the entire point — it is what
 * makes both sides land on identical ids.
 */
export async function loadBriefRequirements(
  brief: Pick<
    ProjectBriefRow,
    "services" | "industryExperience" | "requiredCertifications"
  > & {
    budgetBand?: string | null;
    urgency?: string | null;
  },
): Promise<BriefRequirements> {
  const services = safeJsonParse<string[]>(brief.services, []);
  const industries = safeJsonParse<string[]>(brief.industryExperience, []);
  const certifications = safeJsonParse<string[]>(
    brief.requiredCertifications ?? "[]",
    [],
  );

  const [workloadTagIds, specializationTagIds, verticalTagIds, complianceTagIds] =
    await Promise.all([
      resolveMany("workload", services),
      resolveMany("specialization", services),
      resolveMany("vertical", industries),
      resolveMany("compliance", certifications),
    ]);

  return {
    workloadTagIds,
    specializationTagIds,
    verticalTagIds,
    complianceTagIds,
    // Briefs don't currently enumerate products; product depth is a partner-side
    // differentiator rather than a stated requirement.
    productTagIds: [],
    budgetBand: brief.budgetBand ?? null,
    urgency: brief.urgency ?? null,
  };
}

async function resolveMany(
  facet: TagFacet,
  labels: string[],
): Promise<string[]> {
  const ids = new Set<string>();
  for (const label of labels.slice(0, 40)) {
    if (!label?.trim()) continue;
    const tag = await resolveTag(facet, label);
    if (tag && tag.status !== "rejected") ids.add(tag.id);
  }
  return Array.from(ids);
}

/**
 * Load capabilities for many partners at once.
 *
 * One query for tags across all companies, then grouped in memory — the naive
 * per-partner version turned a sourcing screen into dozens of round-trips.
 */
export async function loadPartnerCapabilities(
  companyIds: string[],
): Promise<Map<string, PartnerCapabilities>> {
  const out = new Map<string, PartnerCapabilities>();
  if (companyIds.length === 0) return out;

  const [tagRows, profiles] = await Promise.all([
    query<{
      companyId: string;
      tagId: string;
      facet: string;
      label: string;
    }>(
      `SELECT pt."companyId", pt."tagId", pt."facet", t."label"
       FROM "PartnerTag" pt
       JOIN "Tag" t ON t."id" = pt."tagId"
       WHERE pt."companyId" = ANY($1)`,
      [companyIds],
    ),
    query<PartnerProfileRow>(
      'SELECT * FROM "PartnerProfile" WHERE "companyId" = ANY($1)',
      [companyIds],
    ),
  ]);

  const byCompany = new Map<
    string,
    { facets: Record<string, string[]>; tags: { id: string; label: string }[] }
  >();
  for (const row of tagRows) {
    const entry =
      byCompany.get(row.companyId) ?? { facets: {}, tags: [] };
    (entry.facets[row.facet] ??= []).push(row.tagId);
    entry.tags.push({ id: row.tagId, label: row.label });
    byCompany.set(row.companyId, entry);
  }

  for (const profile of profiles) {
    const entry = byCompany.get(profile.companyId) ?? {
      facets: {},
      tags: [],
    };

    // Evidence corpus: everything the partner has claimed to have *done*, as
    // opposed to everything they say they can do.
    const caseStudies = safeJsonParse<
      { title?: string; summary?: string; outcome?: string; industry?: string }[]
    >(profile.caseStudies ?? "[]", []);
    const ipAssets = safeJsonParse<
      { name?: string; description?: string }[]
    >(profile.ipAssets ?? "[]", []);

    const evidence = [
      ...caseStudies.flatMap((c) => [
        c.title ?? "",
        c.summary ?? "",
        c.outcome ?? "",
        c.industry ?? "",
      ]),
      ...ipAssets.flatMap((a) => [a.name ?? "", a.description ?? ""]),
    ];

    out.set(profile.companyId, {
      workloadTagIds: entry.facets.workload ?? [],
      verticalTagIds: entry.facets.vertical ?? [],
      specializationTagIds: entry.facets.specialization ?? [],
      complianceTagIds: entry.facets.compliance ?? [],
      productTagIds: entry.facets.product ?? [],
      minDealSize: profile.minDealSize,
      benchAvailability: profile.benchAvailability,
      substantiatedTagIds: deriveSubstantiatedTagIds(entry.tags, evidence),
      profileStrength: profile.profileStrength,
      lastVerifiedAt: profile.lastVerifiedAt,
    });
  }

  return out;
}

/** Single-partner convenience wrapper. */
export async function loadOnePartnerCapabilities(
  companyId: string,
): Promise<PartnerCapabilities | null> {
  const map = await loadPartnerCapabilities([companyId]);
  return map.get(companyId) ?? null;
}

/** Does this partner have any structured tags yet? */
export async function hasStructuredProfile(
  companyId: string,
): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM "PartnerTag" WHERE "companyId" = $1',
    [companyId],
  );
  return (row?.n ?? 0) > 0;
}

// ─── Unified scoring ──────────────────────────────────────────

/**
 * One match result regardless of which engine produced it, so call sites don't
 * branch on engine internals.
 */
export interface UnifiedMatch {
  partnerId: string;
  score: number;
  label: MatchBreakdown["label"];
  reasons: string[];
  /** False when a hard gate failed. Always true for legacy scoring. */
  eligible: boolean;
  gates: GateReason[];
  /** Which engine ran — surfaced so admins can see coverage during rollout. */
  engine: "tags" | "legacy";
  /** Canonical tag ids matched with supporting evidence. */
  substantiated: string[];
}

/**
 * Score a brief against many partners, preferring the tag engine.
 *
 * **Why hybrid rather than a clean cutover.** Tag-based scoring is strictly
 * better, but it needs `PartnerTag` rows to exist. A hard switch would score
 * every not-yet-migrated partner at zero and empty the sourcing funnel
 * overnight. Falling back per-partner means the new engine improves results the
 * moment a partner completes onboarding, with no flag day.
 *
 * The two engines produce comparable 0–100 scores, so mixed results still rank
 * sensibly against each other.
 */
export async function scorePartnersForBrief(
  brief: Parameters<typeof loadBriefRequirements>[0] &
    Pick<ProjectBriefRow, "preferredLocation"> & {
      executiveSummary?: string | null;
    },
  partners: (CompanyRow & { partnerProfile: PartnerProfileRow | null })[],
  { now = new Date() }: { now?: Date } = {},
): Promise<Map<string, UnifiedMatch>> {
  const out = new Map<string, UnifiedMatch>();
  if (partners.length === 0) return out;

  const [requirements, capabilities, performance] = await Promise.all([
    loadBriefRequirements(brief),
    loadPartnerCapabilities(partners.map((p) => p.id)),
    // Feedback loop: what these partners actually delivered before.
    loadPartnerPerformance(partners.map((p) => p.id), { now }),
  ]);

  // If the brief itself resolved to no tags there is nothing for the tag engine
  // to match on, so legacy scoring is the more informative choice throughout.
  const briefHasTags =
    requirements.workloadTagIds.length > 0 ||
    requirements.specializationTagIds.length > 0 ||
    requirements.verticalTagIds.length > 0 ||
    requirements.complianceTagIds.length > 0;

  for (const partner of partners) {
    const caps = capabilities.get(partner.id);
    const partnerHasTags =
      caps !== undefined &&
      caps.workloadTagIds.length +
        caps.specializationTagIds.length +
        caps.verticalTagIds.length >
        0;

    if (briefHasTags && partnerHasTags) {
      const v2 = computeMatchV2(
        { ...requirements },
        { ...caps, performance: performance.get(partner.id) ?? null },
        { now },
      );
      out.set(partner.id, {
        partnerId: partner.id,
        score: v2.score,
        label: v2.label,
        reasons: v2.reasons,
        eligible: v2.eligible,
        gates: v2.gates,
        engine: "tags",
        substantiated: caps.substantiatedTagIds,
      });
      continue;
    }

    const legacy = computeMatch({ brief, partner });
    out.set(partner.id, {
      partnerId: partner.id,
      score: legacy.score,
      label: legacy.label,
      reasons: legacy.reasons,
      eligible: true,
      gates: [],
      engine: "legacy",
      substantiated: [],
    });
  }

  return out;
}
