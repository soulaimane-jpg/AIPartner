/**
 * Public partner directory reader.
 *
 * Surfaces a redacted subset of `PartnerProfile` for the public
 * `/partners` page and the corresponding `/api/v1/partners` endpoint.
 *
 * Privacy filters:
 *   - Only PARTNER companies whose profile has `acceptedTermsAt` set
 *     are visible (they've consented to public listing as part of
 *     onboarding).
 *   - `leadRoutingEmail` is NEVER returned — public callers route
 *     through the brief flow, not direct email.
 *   - Owner names and seat counts are hidden.
 *
 * This module deliberately stays read-only; mutation goes through
 * `lib/actions/partner.ts`.
 */

import "server-only";
import { query, queryOne } from "@/lib/db";

export interface DirectoryPartner {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  headquarters: string | null;
  tier: string;
  regions: string[];
  languages: string[];
  specializations: string[];
  industryExperience: string[];
  certifications: Array<{ name: string; level?: string; count?: number }>;
  serviceModels: string[];
  partnerSince: string | null;
  gcpTier: string | null;
  logoUrl: string | null;
}

export interface DirectoryFilters {
  region?: string;
  industry?: string;
  specialization?: string;
  tier?: string;
  /** Free-text search across name + tagline + description. */
  q?: string;
  /** Pagination — defaults to first 24. */
  cursor?: string;
  limit?: number;
}

export interface DirectoryPage {
  partners: DirectoryPartner[];
  nextCursor: string | null;
  total: number;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 24;

export async function listPublicPartners(
  filters: DirectoryFilters = {},
): Promise<DirectoryPage> {
  const limit = Math.min(
    Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  // JSON-string columns keep their text predicates in-memory after a
  // cheap SQL pre-filter (company kind + accepted terms + tier + q).
  // Fine at the current partner count (<10k); GIN indexes come later.
  const candidates = await query<CandidateRow>(
    `${CANDIDATE_SELECT}
     WHERE pp."acceptedTermsAt" IS NOT NULL
       AND c."kind" = 'PARTNER'
       AND ($1::text IS NULL OR pp."tier" = $1)
       AND ($2::text IS NULL OR pp."tagline" ILIKE '%' || $2 || '%'
            OR pp."description" ILIKE '%' || $2 || '%'
            OR c."name" ILIKE '%' || $2 || '%')
     ORDER BY pp."tier" ASC, pp."updatedAt" DESC`,
    [filters.tier ? filters.tier.toUpperCase() : null, filters.q ?? null],
  );

  const enriched = candidates.map(toDirectoryPartner);

  const filtered = enriched.filter((p) => {
    if (filters.region && !p.regions.some((r) => matches(r, filters.region!))) {
      return false;
    }
    if (
      filters.industry &&
      !p.industryExperience.some((i) => matches(i, filters.industry!))
    ) {
      return false;
    }
    if (
      filters.specialization &&
      !p.specializations.some((s) => matches(s, filters.specialization!))
    ) {
      return false;
    }
    return true;
  });

  const startIndex = filters.cursor ? decodeCursor(filters.cursor) : 0;
  const slice = filtered.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < filtered.length
      ? encodeCursor(startIndex + limit)
      : null;

  return {
    partners: slice,
    nextCursor,
    total: filtered.length,
  };
}

export async function findPublicPartner(
  companyId: string,
): Promise<DirectoryPartner | null> {
  const row = await queryOne<CandidateRow>(
    `${CANDIDATE_SELECT}
     WHERE pp."companyId" = $1 AND pp."acceptedTermsAt" IS NOT NULL
     LIMIT 1`,
    [companyId],
  );
  return row ? toDirectoryPartner(row) : null;
}

const CANDIDATE_SELECT = `
  SELECT pp."id", pp."companyId", pp."tagline", pp."description",
         pp."website", pp."headquarters", pp."teamSize", pp."tier",
         pp."regions", pp."languages", pp."specializations",
         pp."industryExperience", pp."certifications", pp."serviceModels",
         pp."partnerSince", pp."gcpTier", pp."logoUrl",
         c."name" AS "companyName"
  FROM "PartnerProfile" pp
  JOIN "Company" c ON c."id" = pp."companyId"`;

interface CandidateRow {
  id: string;
  companyId: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  headquarters: string | null;
  teamSize: string | null;
  tier: string;
  regions: string;
  languages: string;
  specializations: string;
  industryExperience: string;
  certifications: string;
  serviceModels: string;
  partnerSince: string | null;
  gcpTier: string | null;
  logoUrl: string | null;
  companyName: string;
}

function toDirectoryPartner(row: CandidateRow): DirectoryPartner {
  return {
    id: row.companyId,
    name: row.companyName,
    tagline: row.tagline,
    description: row.description,
    website: row.website,
    headquarters: row.headquarters,
    tier: row.tier,
    regions: parseStringArray(row.regions),
    languages: parseStringArray(row.languages),
    specializations: parseStringArray(row.specializations),
    industryExperience: parseStringArray(row.industryExperience),
    certifications: parseCertifications(row.certifications),
    serviceModels: parseStringArray(row.serviceModels),
    partnerSince: row.partnerSince,
    gcpTier: row.gcpTier,
    logoUrl: row.logoUrl,
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseCertifications(
  raw: string,
): Array<{ name: string; level?: string; count?: number }> {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((c) => c && typeof c === "object" && typeof c.name === "string")
      .map((c) => ({
        name: String(c.name),
        level: typeof c.level === "string" ? c.level : undefined,
        count: typeof c.count === "number" ? c.count : undefined,
      }));
  } catch {
    return [];
  }
}

function matches(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function encodeCursor(n: number): string {
  return Buffer.from(`p:${n}`, "utf8").toString("base64url");
}
function decodeCursor(s: string): number {
  try {
    const decoded = Buffer.from(s, "base64url").toString("utf8");
    const m = /^p:(\d+)$/.exec(decoded);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}
