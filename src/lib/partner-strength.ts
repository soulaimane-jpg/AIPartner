/**
 * Profile strength — weighted completeness plus a next-best-action.
 *
 * Replaces the flat 12-item boolean count that used to live in
 * `partner-portal.ts`. Two differences that matter:
 *
 *  1. **Weighted by buyer value, not effort.** Case studies are worth more
 *     than office locations because clients decide on them. Weights live on
 *     the field registry so this file never needs a hardcoded list.
 *  2. **Returns the single highest-value gap.** "Profile Strength: 85% —
 *     Add 1 PoC Package to hit 100%" is actionable in a way that a bare
 *     percentage is not.
 *
 * Pure and dependency-free so it can run in a Server Component or a job.
 */

import {
  PILLARS,
  PILLAR_FIELDS,
  TOTAL_FIELD_WEIGHT,
  pillarsInOrder,
  type FieldMeta,
  type PillarKey,
} from "@/lib/partner-pillars";
import type { PillarValues } from "@/lib/partner-pillar-values";

export type { PillarValues };

export interface FieldGap {
  key: string;
  label: string;
  pillar: PillarKey;
  pillarLabel: string;
  weight: number;
  required: boolean;
}

export interface PillarProgress {
  key: PillarKey;
  label: string;
  earned: number;
  possible: number;
  /** 0–100 within this pillar. */
  percent: number;
  complete: boolean;
}

export interface StrengthResult {
  /** 0–100 across the whole registry. */
  score: number;
  /** Unfilled fields, highest weight first. */
  missing: FieldGap[];
  /** Unfilled fields that block wizard completion. */
  missingRequired: FieldGap[];
  /** Copy for the nudge, or null at 100%. */
  nextBestAction: string | null;
  perPillar: PillarProgress[];
  /** True once every `required: true` field is filled. */
  readyToComplete: boolean;
}

/**
 * Is this field answered?
 *
 * Deliberately strict about zero and empty string: a partner who has not
 * touched a slider should not be credited for it. `0` is only meaningful
 * for `ratio`, where it is a real answer ("no senior staff") — but that
 * arrives as an explicit number rather than the default, so we treat any
 * present number as filled and let the UI decide when to send one.
 */
export function isFieldFilled(field: FieldMeta, value: unknown): boolean {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    // Repeaters hold objects; require at least one with real content.
    if (field.control === "repeater") {
      return value.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          Object.values(entry as Record<string, unknown>).some(
            (v) => typeof v === "string" && v.trim().length > 0,
          ),
      );
    }
    return true;
  }

  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;

  if (typeof value === "object") {
    // Range/valueRanges objects: filled when any bound is set.
    return Object.values(value as Record<string, unknown>).some(
      (v) =>
        v !== null &&
        v !== undefined &&
        (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0),
    );
  }

  return false;
}

function toGap(field: FieldMeta): FieldGap {
  return {
    key: field.key,
    label: field.label,
    pillar: field.pillar,
    pillarLabel: PILLARS[field.pillar].label,
    weight: field.weight,
    required: field.required,
  };
}

export function computeProfileStrength(values: PillarValues): StrengthResult {
  let earned = 0;
  const missing: FieldGap[] = [];

  const perPillarTotals = new Map<PillarKey, { earned: number; possible: number }>();

  for (const field of Object.values(PILLAR_FIELDS)) {
    const bucket = perPillarTotals.get(field.pillar) ?? {
      earned: 0,
      possible: 0,
    };
    bucket.possible += field.weight;

    if (isFieldFilled(field, values[field.key])) {
      earned += field.weight;
      bucket.earned += field.weight;
    } else {
      missing.push(toGap(field));
    }
    perPillarTotals.set(field.pillar, bucket);
  }

  // Required first, then by weight — so the nudge always points at the
  // thing that unblocks the partner before the thing that merely polishes.
  missing.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.weight - a.weight;
  });

  const missingRequired = missing.filter((m) => m.required);
  const score =
    TOTAL_FIELD_WEIGHT > 0
      ? Math.round((earned / TOTAL_FIELD_WEIGHT) * 100)
      : 0;

  const perPillar: PillarProgress[] = pillarsInOrder().map((p) => {
    const bucket = perPillarTotals.get(p.key) ?? { earned: 0, possible: 0 };
    const percent =
      bucket.possible > 0
        ? Math.round((bucket.earned / bucket.possible) * 100)
        : 100;
    return {
      key: p.key,
      label: p.label,
      earned: bucket.earned,
      possible: bucket.possible,
      percent,
      complete: percent === 100,
    };
  });

  return {
    score,
    missing,
    missingRequired,
    nextBestAction: buildNextBestAction(score, missing),
    perPillar,
    readyToComplete: missingRequired.length === 0,
  };
}

/**
 * "Profile Strength: 85% — Add Case studies to reach 99%."
 *
 * Shows the score the partner would land on after this one action, which
 * is far more motivating than naming the gap alone.
 */
function buildNextBestAction(
  score: number,
  missing: FieldGap[],
): string | null {
  const top = missing[0];
  if (!top) return null;

  const projected =
    TOTAL_FIELD_WEIGHT > 0
      ? Math.min(
          100,
          Math.round(
            ((score / 100) * TOTAL_FIELD_WEIGHT + top.weight) /
              TOTAL_FIELD_WEIGHT *
              100,
          ),
        )
      : score;

  const verb = top.required ? "Required:" : "Add";
  return `${verb} ${top.label} to reach ${projected}%.`;
}

// ─── Freshness ────────────────────────────────────────────────

/** Profiles unverified for longer than this lose the badge. */
export const FRESHNESS_WINDOW_DAYS = 183; // ~6 months

export type FreshnessState = "fresh" | "stale" | "never";

export interface Freshness {
  state: FreshnessState;
  /** "Verified Active: Q3 2026", or null when never verified. */
  label: string | null;
  daysSinceVerified: number | null;
}

export function computeFreshness(
  lastVerifiedAt: Date | string | null | undefined,
  now: Date = new Date(),
): Freshness {
  if (!lastVerifiedAt) {
    return { state: "never", label: null, daysSinceVerified: null };
  }

  const verified =
    lastVerifiedAt instanceof Date ? lastVerifiedAt : new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) {
    return { state: "never", label: null, daysSinceVerified: null };
  }

  const days = Math.floor(
    (now.getTime() - verified.getTime()) / 86_400_000,
  );
  const quarter = Math.floor(verified.getMonth() / 3) + 1;
  const label = `Verified Active: Q${quarter} ${verified.getFullYear()}`;

  return {
    state: days <= FRESHNESS_WINDOW_DAYS ? "fresh" : "stale",
    label,
    daysSinceVerified: days,
  };
}
