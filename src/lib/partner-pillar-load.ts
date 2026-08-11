import "server-only";

/**
 * Server-side loader for a partner's pillar state.
 *
 * One function used by the profile editor, the onboarding wizard, the dashboard
 * and the admin partner view. Centralising it means all four always agree on
 * strength, freshness and tag labels — the alternative is four subtly different
 * numbers on four screens, which is how trust in a score dies.
 */

import { query, queryOne } from "@/lib/db";
import type { PartnerProfileRow } from "@/lib/db/rows";
import { PILLAR_FIELDS } from "@/lib/partner-pillars";
import {
  readPillarValues,
  type PillarValues,
} from "@/lib/partner-pillar-values";
import {
  computeFreshness,
  computeProfileStrength,
  type Freshness,
  type StrengthResult,
} from "@/lib/partner-strength";
import { partnerTagsByFacet } from "@/lib/tags";
import type { ChangeProposal } from "@/components/partner/change-proposals-card";

export interface PartnerPillarState {
  profile: PartnerProfileRow | null;
  values: PillarValues;
  /** tagId → label, for rendering chips without a client round-trip. */
  tagLabels: Record<string, string>;
  strength: StrengthResult;
  freshness: Freshness;
  onboardingCompleted: boolean;
  onboardingStep: string | null;
}

export async function loadPartnerPillarState(
  companyId: string,
): Promise<PartnerPillarState> {
  const [profile, tagsByFacet] = await Promise.all([
    queryOne<PartnerProfileRow>(
      'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
      [companyId],
    ),
    partnerTagsByFacet(companyId),
  ]);

  const tagIdsByFacet: Record<string, string[]> = {};
  const tagLabels: Record<string, string> = {};
  for (const [facet, tags] of Object.entries(tagsByFacet)) {
    tagIdsByFacet[facet] = tags.map((t) => t.id);
    for (const t of tags) tagLabels[t.id] = t.label;
  }

  const values = readPillarValues(profile, tagIdsByFacet);

  return {
    profile,
    values,
    tagLabels,
    strength: computeProfileStrength(values),
    freshness: computeFreshness(profile?.lastVerifiedAt ?? null),
    onboardingCompleted: Boolean(profile?.onboardingCompletedAt),
    onboardingStep: profile?.onboardingStep ?? null,
  };
}

/**
 * Human labels for the plain profile columns the re-scrape can propose.
 *
 * These sit outside the pillar registry because they are company facts rather
 * than capability claims, but proposals still need to name them readably.
 */
const SCRAPEABLE_FIELD_LABELS: Record<string, string> = {
  tagline: "Tagline",
  description: "Company overview",
  website: "Website",
  headquarters: "Headquarters",
  teamSize: "Team size",
  industry: "Primary industry",
  gcpTier: "Google Cloud tier",
  partnerSince: "Partner since",
  logoUrl: "Logo",
};

export function labelForProposalField(fieldKey: string): string {
  return (
    SCRAPEABLE_FIELD_LABELS[fieldKey] ??
    PILLAR_FIELDS[fieldKey]?.label ??
    fieldKey
  );
}

export async function loadPendingChangeProposals(
  companyId: string,
): Promise<ChangeProposal[]> {
  const rows = await query<{
    id: string;
    fieldKey: string;
    source: string;
    currentValue: string | null;
    proposedValue: string | null;
  }>(
    `SELECT "id","fieldKey","source","currentValue","proposedValue"
     FROM "ProfileChangeProposal"
     WHERE "companyId" = $1 AND "status" = 'pending'
     ORDER BY "createdAt" ASC
     LIMIT 20`,
    [companyId],
  );

  return rows.map((r) => ({
    id: r.id,
    fieldKey: r.fieldKey,
    fieldLabel: labelForProposalField(r.fieldKey),
    source: r.source,
    currentValue: r.currentValue,
    proposedValue: r.proposedValue,
  }));
}
