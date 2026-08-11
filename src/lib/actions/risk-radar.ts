"use server";

/**
 * Risk Radar — pre-submit AI audit of a draft brief.
 *
 * Runs Claude over the current draft, parses its JSON with the
 * `RiskRadarReportV1` schema, caches the result keyed on a content
 * hash so repeated views inside the submit flow don't burn tokens,
 * and exposes `acknowledgeRiskRadarAction` so the customer's "I've
 * read this" click is recorded.
 *
 * Severity contract:
 *   - `info`  : the customer can submit without acknowledging.
 *   - `warn`  : the UI urges them to acknowledge before submitting.
 *   - `block` : `brief.submit` refuses until findings are addressed.
 *
 * The `brief.submit` action *also* consults the latest report — never
 * trust the client to gatekeep this.
 */

import "node:crypto";
import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import type { RiskRadarReportRow } from "@/lib/db/rows";
import { parseLlmJson } from "@/lib/ai/parse";
import {
  RiskRadarReportV1,
  RISK_RADAR_VERSION,
} from "@/lib/schemas/ai/risk-radar";

const RISK_RADAR_SYSTEM = `You are AI Partner's pre-submit reviewer.

A customer has drafted a Statement of Work for a Google Cloud project and is about to send it to partners.

Your job: scan it for problems before partners see it. Be candid but
respectful. Prefer one strong finding over many vague ones.

Categories you may use:
  - "missing-context"   : a partner cannot bid without knowing this
  - "contradiction"     : two statements in the brief disagree
  - "scope-creep"       : scope expands beyond what budget/timeline support
  - "unrealistic-timeline": the timeline doesn't match the scope
  - "budget-mismatch"   : budget is absent or doesn't fit the scope
  - "compliance-flag"   : data/region/regulatory issue worth flagging
  - "data-residency"    : geographic / sovereignty conflict

Severities:
  - "info"  : worth noting; not blocking
  - "warn"  : strongly recommend fixing
  - "block" : do not let this go to partners as-is

Roll up an "overall" severity (the maximum across findings).

Return ONLY a single JSON object — no prose, no code fences — matching this schema exactly:

{
  "overall": "info" | "warn" | "block",
  "summary": "1-sentence executive summary, or null if overall=info",
  "findings": [
    {
      "id": "short-stable-id",
      "title": "Short human title",
      "detail": "1-3 sentences explaining the problem",
      "severity": "info" | "warn" | "block",
      "category": "<one of the categories above>",
      "fieldHints": ["budgetRange", "..."],
      "suggestion": "What the customer should do next, 1 sentence"
    }
  ]
}

Return at most 8 findings. Empty array is fine if the brief is solid.`;

/** Stable hash of the brief fields the radar evaluates. */
function hashBriefForRadar(b: {
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
}): string {
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

function buildUserMessage(b: {
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
}): string {
  const sect = (label: string, value: string | null) =>
    value && value.trim().length > 0 ? `### ${label}\n${value.trim()}` : `### ${label}\n(empty)`;
  return [
    `# Project brief: ${b.title}`,
    sect("Executive summary", b.executiveSummary),
    sect("Scope requirements", b.scopeRequirements),
    sect("Integration points", b.integrationPoints),
    sect("Data sources", b.dataSources),
    sect("Success criteria", b.successCriteria),
    sect("Target go-live", b.targetGoLive),
    sect("Budget", b.budgetRange),
    sect("Preferred location", b.preferredLocation),
    sect("Required certifications", b.requiredCertifications),
  ].join("\n\n");
}

// ─── Run / refresh the radar ─────────────────────────────────────

const RunRiskRadarInput = z.object({
  briefId: z.string().min(1),
  /** If true, ignore the cache and re-run Claude. */
  force: z.boolean().optional().default(false),
});

export const runRiskRadarAction = defineAction({
  name: "risk-radar.run",
  input: RunRiskRadarInput,
  output: z.object({
    reportId: z.string(),
    overall: z.enum(["info", "warn", "block"]),
    findingCount: z.number().int().nonnegative(),
    fromCache: z.boolean(),
  }),
  permission: "brief.update",
  rateLimit: { scope: "risk-radar.run", limit: 12, windowSec: 600 },
  handler: async ({ briefId, force }, ctx) => {
    const brief = await queryOne<{
      id: string;
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
    }>(
      `SELECT "id", "title", "executiveSummary", "scopeRequirements",
              "integrationPoints", "dataSources", "successCriteria",
              "targetGoLive", "budgetRange", "preferredLocation",
              "requiredCertifications"
       FROM "ProjectBrief" WHERE "id" = $1`,
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    const briefHash = hashBriefForRadar(brief!);

    if (!force) {
      const cached = await queryOne<RiskRadarReportRow>(
        `SELECT * FROM "RiskRadarReport"
         WHERE "briefId" = $1 AND "briefHash" = $2 AND "promptVer" = $3
         ORDER BY "createdAt" DESC LIMIT 1`,
        [briefId, briefHash, RISK_RADAR_VERSION],
      );
      if (cached) {
        let count = 0;
        try {
          count = (JSON.parse(cached.findings) as unknown[]).length;
        } catch {
          count = 0;
        }
        return {
          reportId: cached.id,
          overall: cached.overall as "info" | "warn" | "block",
          findingCount: count,
          fromCache: true,
        };
      }
    }

    const result = await parseLlmJson({
      schema: RiskRadarReportV1,
      system: RISK_RADAR_SYSTEM,
      user: buildUserMessage(brief!),
      tag: "risk-radar",
      maxTokens: 1800,
      temperature: 0.1,
    });

    if (!result.ok) {
      fail({
        code: "LLM_FAILURE",
        retryable: result.error.code === "LLM_TRANSPORT",
      });
    }

    const row = await insertRow<{ id: string }>("RiskRadarReport", {
      briefId,
      briefHash,
      overall: result.data.overall,
      findings: JSON.stringify(result.data.findings),
      promptVer: RISK_RADAR_VERSION,
    });

    void ctx; // ctx.user used implicitly by audit log in defineAction
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath(`/briefs/${briefId}/builder`);

    return {
      reportId: row.id,
      overall: result.data.overall,
      findingCount: result.data.findings.length,
      fromCache: false,
    };
  },
});

// ─── Acknowledge a report (user clicked "I've read this") ───────

const AckRiskRadarInput = z.object({
  reportId: z.string().min(1),
});

export const acknowledgeRiskRadarAction = defineAction({
  name: "risk-radar.acknowledge",
  input: AckRiskRadarInput,
  permission: "brief.update",
  rateLimit: { scope: "risk-radar.acknowledge", limit: 30, windowSec: 60 },
  handler: async ({ reportId }, ctx) => {
    const row = await queryOne<{ id: string; briefOwnerId: string }>(
      `SELECT r."id", b."ownerId" AS "briefOwnerId"
       FROM "RiskRadarReport" r
       JOIN "ProjectBrief" b ON b."id" = r."briefId"
       WHERE r."id" = $1`,
      [reportId],
    );
    if (!row) fail({ code: "NOT_FOUND", resource: "RiskRadarReport" });
    if (row!.briefOwnerId !== ctx.user!.id) {
      fail({ code: "FORBIDDEN" });
    }
    await updateRows(
      "RiskRadarReport",
      { id: reportId },
      {
        acknowledgedAt: new Date(),
        acknowledgedBy: ctx.user!.id,
      },
      { noUpdatedAt: true },
    );
    revalidatePath(`/briefs/${row!.briefOwnerId}`);
    return { ok: true as const };
  },
});

// ─── Read helper for server components ────────────────────────────

export async function getLatestRiskRadarReport(briefId: string) {
  const row = await queryOne<RiskRadarReportRow>(
    `SELECT * FROM "RiskRadarReport"
     WHERE "briefId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [briefId],
  );
  if (!row) return null;
  let findings: unknown[] = [];
  try {
    findings = JSON.parse(row.findings);
  } catch {
    findings = [];
  }
  return {
    id: row.id,
    briefId: row.briefId,
    briefHash: row.briefHash,
    overall: row.overall as "info" | "warn" | "block",
    findings,
    promptVer: row.promptVer,
    acknowledgedAt: row.acknowledgedAt,
    createdAt: row.createdAt,
  };
}
