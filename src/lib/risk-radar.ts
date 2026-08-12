import "server-only";

import { createHash } from "node:crypto";
import { queryOne } from "@/lib/db";
import { RISK_RADAR_VERSION } from "@/lib/schemas/ai/risk-radar";

/**
 * Risk Radar gate helpers, shared by the action that produces reports
 * and the submit gate that consumes them.
 *
 * Lives outside `actions/` because a `"use server"` module may only
 * export async Server Actions.
 */

/** Fields the radar evaluates — a change to any of them stales a report. */
export interface RadarBriefFields {
  title: string;
  executiveSummary: string | null;
  scopeRequirements: string | null;
  integrationPoints: string | null;
  dataSources: string | null;
  successCriteria: string | null;
  targetGoLive: string | null;
  budgetRange: string | null;
  preferredLocation: string | null;
  requiredCertifications: string | null;
}

export const RADAR_BRIEF_COLUMNS = `"title", "executiveSummary", "scopeRequirements",
       "integrationPoints", "dataSources", "successCriteria",
       "targetGoLive", "budgetRange", "preferredLocation",
       "requiredCertifications"`;

/** Stable hash of the brief fields the radar evaluates. */
export function hashBriefForRadar(b: RadarBriefFields): string {
  const payload = JSON.stringify({
    title: b.title,
    s: b.executiveSummary,
    r: b.scopeRequirements,
    i: b.integrationPoints,
    d: b.dataSources,
    c: b.successCriteria,
    t: b.targetGoLive,
    bu: b.budgetRange,
    l: b.preferredLocation,
    cr: b.requiredCertifications,
    v: RISK_RADAR_VERSION,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export type RadarGateVerdict =
  | { ok: true }
  | { ok: false; reason: string; kind: "missing" | "stale" | "failed" | "blocked" };

/**
 * Fail-closed submit gate.
 *
 * The original check was `if (radar && radar.overall === "block" && …)`,
 * which passed whenever no report existed — and no report is exactly
 * what an Anthropic outage produces. It also accepted a report written
 * against an older version of the brief, so a customer could pass the
 * radar, then edit the risky field back in and submit.
 *
 * Now: submission requires a report for the *current* brief hash, and
 * `block`/`failed` must be explicitly acknowledged.
 */
export async function evaluateRiskRadarGate(
  briefId: string,
  brief: RadarBriefFields,
): Promise<RadarGateVerdict> {
  const expectedHash = hashBriefForRadar(brief);

  const latest = await queryOne<{
    id: string;
    overall: string;
    briefHash: string;
    acknowledgedAt: Date | null;
  }>(
    `SELECT "id", "overall", "briefHash", "acknowledgedAt"
       FROM "RiskRadarReport"
      WHERE "briefId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 1`,
    [briefId],
  );

  if (!latest) {
    return {
      ok: false,
      kind: "missing",
      reason:
        "Run the pre-submit review (Risk Radar) before sending this brief to our team.",
    };
  }

  if (latest.briefHash !== expectedHash) {
    return {
      ok: false,
      kind: "stale",
      reason:
        "This brief changed since its last pre-submit review. Re-run Risk Radar before submitting.",
    };
  }

  // A failed run is not a pass. The customer can still proceed by
  // acknowledging it, so an outage doesn't hard-block the funnel — but
  // it becomes a deliberate, audited choice rather than a silent skip.
  if (latest.overall === "failed" && !latest.acknowledgedAt) {
    return {
      ok: false,
      kind: "failed",
      reason:
        "The pre-submit review couldn't complete. Re-run it, or acknowledge the report to submit anyway.",
    };
  }

  if (latest.overall === "block" && !latest.acknowledgedAt) {
    return {
      ok: false,
      kind: "blocked",
      reason:
        "Risk Radar flagged blocking issues. Address them or acknowledge the report before submitting.",
    };
  }

  return { ok: true };
}
