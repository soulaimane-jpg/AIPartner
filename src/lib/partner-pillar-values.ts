/**
 * Serialization between `PartnerProfile` rows and registry-keyed pillar values.
 *
 * The registry (`partner-pillars.ts`) is the schema; this file is the only place
 * that knows how each control's value is stored. Keeping that knowledge here
 * means the form, the wizard, the validator and the scorer all speak one
 * in-memory shape and never touch column encodings.
 *
 * Tag fields are the exception: they live in `PartnerTag`, not on the profile
 * row, so `readPillarValues()` takes the tag ids separately.
 */

import {
  PILLAR_FIELDS,
  type FieldMeta,
} from "@/lib/partner-pillars";
import type { PartnerProfileRow } from "@/lib/db/rows";
import { safeJsonParse } from "@/lib/utils";

/** One entry in the IP & accelerators repeater. */
export interface IpAsset {
  name: string;
  category: string;
  description: string;
  access: string;
  impact: string;
  timeSaved: string;
}

/**
 * Case study. Extends the legacy shape with the fields the feedback asks for —
 * recency and whether a reference is actually reachable.
 */
export interface CaseStudy {
  title: string;
  client: string;
  industry: string;
  summary: string;
  outcome: string;
  link: string;
  engagementDate: string;
  referenceAvailable: boolean;
  confidential: boolean;
}

/** Inclusive numeric bounds. `null` means "not stated". */
export interface NumericRange {
  low: number | null;
  high: number | null;
}

export interface ValueRanges {
  cloudSavingsPct?: NumericRange;
  migrationMonths?: NumericRange;
}

export const EMPTY_IP_ASSET: IpAsset = {
  name: "",
  category: "",
  description: "",
  access: "",
  impact: "",
  timeSaved: "",
};

export const EMPTY_CASE_STUDY: CaseStudy = {
  title: "",
  client: "",
  industry: "",
  summary: "",
  outcome: "",
  link: "",
  engagementDate: "",
  referenceAvailable: false,
  confidential: false,
};

/**
 * In-memory pillar state. Loosely typed on purpose — the registry decides
 * which key holds which shape, and a discriminated union keyed by 19 field
 * names would add ceremony without catching real bugs.
 */
export type PillarValues = Record<string, unknown>;

function emptyRange(): NumericRange {
  return { low: null, high: null };
}

function coerceRange(raw: unknown): NumericRange {
  // Stored as a two-element tuple; tolerate an object for forward-compat.
  if (Array.isArray(raw)) {
    const [low, high] = raw;
    return {
      low: typeof low === "number" && Number.isFinite(low) ? low : null,
      high: typeof high === "number" && Number.isFinite(high) ? high : null,
    };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      low: typeof o.low === "number" ? o.low : null,
      high: typeof o.high === "number" ? o.high : null,
    };
  }
  return emptyRange();
}

function coerceIpAssets(raw: string | null | undefined): IpAsset[] {
  return safeJsonParse<Partial<IpAsset>[]>(raw ?? "[]", []).map((a) => ({
    ...EMPTY_IP_ASSET,
    ...a,
    name: String(a?.name ?? ""),
  }));
}

function coerceCaseStudies(raw: string | null | undefined): CaseStudy[] {
  return safeJsonParse<Partial<CaseStudy>[]>(raw ?? "[]", []).map((c) => ({
    ...EMPTY_CASE_STUDY,
    ...c,
    title: String(c?.title ?? ""),
    referenceAvailable: Boolean(c?.referenceAvailable),
    confidential: Boolean(c?.confidential),
  }));
}

/**
 * Build registry-keyed values from a profile row plus its tag ids.
 *
 * `tagIdsByFacet` comes from `partnerTagIdsByFacet()`. A tag field whose facet
 * has no rows resolves to `[]` rather than undefined, so controls stay
 * controlled and React never warns about switching modes.
 */
export function readPillarValues(
  profile: PartnerProfileRow | null,
  tagIdsByFacet: Record<string, string[]> = {},
): PillarValues {
  const values: PillarValues = {};

  for (const field of Object.values(PILLAR_FIELDS)) {
    if (field.control === "tags" && field.facet) {
      values[field.key] = tagIdsByFacet[field.facet] ?? [];
      continue;
    }
    values[field.key] = readScalar(field, profile);
  }

  return values;
}

function readScalar(
  field: FieldMeta,
  profile: PartnerProfileRow | null,
): unknown {
  switch (field.key) {
    case "ipAssets":
      return coerceIpAssets(profile?.ipAssets);
    case "caseStudies":
      return coerceCaseStudies(profile?.caseStudies);
    case "resellPlatforms":
      return profile?.resellPlatforms ?? "";
    case "engagementModels":
      return safeJsonParse<string[]>(profile?.engagementModels ?? "[]", []);
    case "collaborationStyles":
      return safeJsonParse<string[]>(profile?.collaborationStyles ?? "[]", []);
    case "minDealSize":
      return profile?.minDealSize ?? "";
    case "pocOffering":
      return profile?.pocOffering ?? "";
    case "benchAvailability":
      return profile?.benchAvailability ?? "";
    case "referenceAvailability":
      return profile?.referenceAvailability ?? "";
    case "seniorityRatio":
      return profile?.seniorityRatio ?? null;
    case "typicalContractMonths":
      return coerceRange(
        safeJsonParse<unknown>(profile?.typicalContractMonths ?? "null", null),
      );
    case "valueRanges": {
      const parsed = safeJsonParse<Record<string, unknown>>(
        profile?.valueRanges ?? "{}",
        {},
      );
      const ranges: ValueRanges = {
        cloudSavingsPct: coerceRange(parsed.cloudSavingsPct),
        migrationMonths: coerceRange(parsed.migrationMonths),
      };
      return ranges;
    }
    default:
      // Unknown scalar — fall back to the control's natural empty value so a
      // newly added registry field renders before its column exists.
      return field.control === "multi" || field.control === "repeater"
        ? []
        : "";
  }
}

/** True when a range carries no information and should persist as null. */
function isRangeEmpty(range: NumericRange): boolean {
  return range.low === null && range.high === null;
}

function rangeToTuple(range: NumericRange): [number | null, number | null] {
  return [range.low, range.high];
}

/**
 * Convert validated pillar values into `PartnerProfile` column updates.
 *
 * Only scalar fields are returned — tag fields are reconciled separately via
 * `setPartnerTags()` because they live in a different table.
 */
export function pillarValuesToColumns(
  values: PillarValues,
): Record<string, unknown> {
  const cols: Record<string, unknown> = {};

  if ("ipAssets" in values) {
    cols.ipAssets = JSON.stringify(values.ipAssets ?? []);
  }
  if ("caseStudies" in values) {
    cols.caseStudies = JSON.stringify(values.caseStudies ?? []);
  }
  if ("resellPlatforms" in values) {
    const v = String(values.resellPlatforms ?? "").trim();
    cols.resellPlatforms = v || null;
  }
  if ("engagementModels" in values) {
    cols.engagementModels = JSON.stringify(values.engagementModels ?? []);
  }
  if ("collaborationStyles" in values) {
    cols.collaborationStyles = JSON.stringify(
      values.collaborationStyles ?? [],
    );
  }
  for (const key of [
    "minDealSize",
    "pocOffering",
    "benchAvailability",
    "referenceAvailability",
  ] as const) {
    if (key in values) {
      const v = String(values[key] ?? "").trim();
      cols[key] = v || null;
    }
  }
  if ("seniorityRatio" in values) {
    const raw = values.seniorityRatio;
    cols.seniorityRatio =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(100, Math.max(0, Math.round(raw)))
        : null;
  }
  if ("typicalContractMonths" in values) {
    const range = coerceRange(values.typicalContractMonths);
    cols.typicalContractMonths = isRangeEmpty(range)
      ? null
      : JSON.stringify(rangeToTuple(range));
  }
  if ("valueRanges" in values) {
    const raw = (values.valueRanges ?? {}) as Record<string, unknown>;
    const out: Record<string, [number | null, number | null]> = {};
    for (const key of ["cloudSavingsPct", "migrationMonths"] as const) {
      const range = coerceRange(raw[key]);
      if (!isRangeEmpty(range)) out[key] = rangeToTuple(range);
    }
    cols.valueRanges = JSON.stringify(out);
  }

  return cols;
}
