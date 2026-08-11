/**
 * SLA helpers for the admin pipeline view.
 *
 * Each `ProjectBrief` lives in one of four SLA buckets keyed off
 * "age since last meaningful stage transition":
 *   - **fresh**  : < 24h
 *   - **warm**   : 24-48h
 *   - **hot**    : 48-72h
 *   - **stuck**  : > 72h
 *
 * "Meaningful transition" depends on stage:
 *   - INTAKE       : `createdAt`  → admin needs to triage
 *   - SOURCING     : `triagedAt`  → admin needs to invite partners
 *   - SHORTLIST    : invitedAt    → waiting on partners
 *   - REVIEW       : updatedAt    → customer needs to approve
 *   - SELECTION    : updatedAt    → customer needs to pick
 *   - PROPOSALS    : updatedAt    → proposals being prepared
 *   - INTRODUCTION : updatedAt    → handoff scheduled
 *   - DELIVERED    : (no SLA)
 *
 * We expose `bucketSla(brief)` returning the bucket + numeric age so
 * UIs can colour rows consistently.
 */

import type { ProjectBriefRow as ProjectBrief } from "@/lib/db/rows";

export type SlaBucket = "fresh" | "warm" | "hot" | "stuck" | "none";

export interface SlaInfo {
  bucket: SlaBucket;
  ageHours: number;
  /** Stage-specific label for tooltips. */
  reason: string;
}

const HOUR = 3_600_000;

export function bucketSla(brief: ProjectBrief): SlaInfo {
  const now = Date.now();
  let anchor: Date = brief.updatedAt;
  let reason = "Awaiting next step";

  switch (brief.stage) {
    case "INTAKE":
      anchor = brief.createdAt;
      reason = "Awaiting admin triage";
      break;
    case "SOURCING":
      anchor = brief.triagedAt ?? brief.createdAt;
      reason = "Sourcing partners";
      break;
    case "SHORTLIST":
      anchor = brief.updatedAt;
      reason = "Awaiting partner accepts";
      break;
    case "REVIEW":
      anchor = brief.updatedAt;
      reason = "Awaiting customer approval";
      break;
    case "SELECTION":
      anchor = brief.updatedAt;
      reason = "Customer narrowing to 3";
      break;
    case "PROPOSALS":
      anchor = brief.updatedAt;
      reason = "Partners drafting proposals";
      break;
    case "INTRODUCTION":
      anchor = brief.updatedAt;
      reason = "Introduction in progress";
      break;
    case "DELIVERED":
      return { bucket: "none", ageHours: 0, reason: "Completed" };
    default:
      anchor = brief.updatedAt;
  }

  const ageHours = (now - anchor.getTime()) / HOUR;
  let bucket: SlaBucket;
  if (ageHours < 24) bucket = "fresh";
  else if (ageHours < 48) bucket = "warm";
  else if (ageHours < 72) bucket = "hot";
  else bucket = "stuck";

  return { bucket, ageHours, reason };
}

/** Tailwind classes for each bucket — keeps the colour discipline in one file. */
export const SLA_BUCKET_CLASSES: Record<SlaBucket, string> = {
  fresh: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warm: "bg-amber-50 text-amber-700 border-amber-200",
  hot: "bg-orange-50 text-orange-700 border-orange-200",
  stuck: "bg-rose-50 text-rose-700 border-rose-200",
  none: "bg-muted text-muted-foreground border-border",
};

export const SLA_BUCKET_LABEL: Record<SlaBucket, string> = {
  fresh: "< 24h",
  warm: "24–48h",
  hot: "48–72h",
  stuck: "> 72h",
  none: "—",
};
