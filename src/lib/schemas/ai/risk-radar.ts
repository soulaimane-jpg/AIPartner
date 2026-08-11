/**
 * Risk Radar — LLM output contract for the pre-submit check that
 * scans a brief draft for missing context, contradictions, and
 * unrealistic asks.
 *
 * One finding ≠ one error: severity determines whether the customer
 * can submit anyway (`info` / `warn`) or must address it (`block`).
 *
 * Versioning rules:
 *   - `v1` = this file. Frozen once shipped.
 *   - `v2+` = additive only (new severities / categories go through
 *     a migration path; never silent rename).
 */

import { z } from "zod";

export const RiskFindingCategory = z.enum([
  "missing-context",
  "contradiction",
  "scope-creep",
  "unrealistic-timeline",
  "budget-mismatch",
  "compliance-flag",
  "data-residency",
]);

export const RiskFindingSeverity = z.enum(["info", "warn", "block"]);

export const RiskFindingV1 = z
  .object({
    /** Stable id within a single report — used as React key. */
    id: z.string().min(1).max(40),
    /** Short human title, e.g. "Budget not specified". */
    title: z.string().min(4).max(120),
    /** 1–3 sentences. No markdown. */
    detail: z.string().min(8).max(600),
    severity: RiskFindingSeverity,
    category: RiskFindingCategory,
    /** Field hints the UI can deep-link the user to. */
    fieldHints: z.array(z.string().max(60)).max(6).default([]),
    /** Suggested next user action, e.g. "Add a target Q for go-live". */
    suggestion: z.string().min(4).max(240).optional(),
  })
  .strict();

export type RiskFindingV1 = z.infer<typeof RiskFindingV1>;

export const RiskRadarReportV1 = z
  .object({
    overall: RiskFindingSeverity,
    findings: z.array(RiskFindingV1).max(20),
    /** Optional 1-sentence executive summary; null when overall=info. */
    summary: z.string().max(280).nullable().default(null),
  })
  .strict();

export type RiskRadarReportV1 = z.infer<typeof RiskRadarReportV1>;

export const RISK_RADAR_VERSION = "v1" as const;
