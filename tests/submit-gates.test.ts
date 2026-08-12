/**
 * Submit-gate tests.
 *
 * Both gates were previously bypassable:
 *
 *  - the 40% completion threshold existed only in the preview page, so
 *    a direct Server Action call could submit an empty brief;
 *  - the Risk Radar check fired only when a report existed AND said
 *    `block`, so "never run" and "the model call failed" both passed.
 *
 * These execute the real gate logic against a mocked database.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_SUBMIT_COMPLETION } from "@/lib/brief";

type RadarRow = {
  id: string;
  overall: string;
  briefHash: string;
  acknowledgedAt: Date | null;
} | null;

let radarRow: RadarRow = null;

vi.mock("@/lib/db", () => ({
  query: () => Promise.resolve([]),
  queryOne: () => Promise.resolve(radarRow),
}));

const { evaluateRiskRadarGate, hashBriefForRadar } = await import(
  "@/lib/risk-radar"
);

const BRIEF = {
  title: "Migrate billing to GCP",
  executiveSummary: "Move the billing platform to Google Cloud.",
  scopeRequirements: "Lift and shift, then re-platform.",
  integrationPoints: "SAP, Stripe",
  dataSources: "Postgres",
  successCriteria: "Zero downtime cutover",
  targetGoLive: "2026-06-01",
  budgetRange: "500k-1m",
  preferredLocation: "EU",
  requiredCertifications: "ISO27001",
};

beforeEach(() => {
  radarRow = null;
});

describe("MIN_SUBMIT_COMPLETION", () => {
  it("is a single shared constant used by both UI and server", () => {
    expect(MIN_SUBMIT_COMPLETION).toBe(40);

    const action = readFileSync(
      resolve(process.cwd(), "src/lib/actions/briefs.ts"),
      "utf8",
    );
    const page = readFileSync(
      resolve(
        process.cwd(),
        "src/app/(portal)/briefs/[id]/preview/page.tsx",
      ),
      "utf8",
    );

    // The server must enforce it, not just render it.
    expect(action).toContain("MIN_SUBMIT_COMPLETION");
    expect(action).toMatch(/completion[\s\S]{0,80}<\s*MIN_SUBMIT_COMPLETION/);
    // And the UI must not hardcode a second copy of the threshold.
    expect(page).toContain("MIN_SUBMIT_COMPLETION");
    expect(page).not.toMatch(/completion\s*>=\s*40/);
  });
});

describe("evaluateRiskRadarGate — fails closed", () => {
  it("rejects when no report has ever been produced", async () => {
    const verdict = await evaluateRiskRadarGate("brief-1", BRIEF);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.kind).toBe("missing");
  });

  it("rejects a report written against an older version of the brief", async () => {
    radarRow = {
      id: "r1",
      overall: "info",
      briefHash: "stale-hash",
      acknowledgedAt: null,
    };
    const verdict = await evaluateRiskRadarGate("brief-1", BRIEF);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.kind).toBe("stale");
  });

  it("rejects a failed run — an outage must not silently open the gate", async () => {
    radarRow = {
      id: "r1",
      overall: "failed",
      briefHash: hashBriefForRadar(BRIEF),
      acknowledgedAt: null,
    };
    const verdict = await evaluateRiskRadarGate("brief-1", BRIEF);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.kind).toBe("failed");
  });

  it("still rejects unacknowledged blocking findings", async () => {
    radarRow = {
      id: "r1",
      overall: "block",
      briefHash: hashBriefForRadar(BRIEF),
      acknowledgedAt: null,
    };
    const verdict = await evaluateRiskRadarGate("brief-1", BRIEF);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.kind).toBe("blocked");
  });

  it("passes a current clean report", async () => {
    radarRow = {
      id: "r1",
      overall: "info",
      briefHash: hashBriefForRadar(BRIEF),
      acknowledgedAt: null,
    };
    expect((await evaluateRiskRadarGate("brief-1", BRIEF)).ok).toBe(true);
  });

  it("lets an acknowledged block or failure through as a deliberate choice", async () => {
    for (const overall of ["block", "failed"]) {
      radarRow = {
        id: "r1",
        overall,
        briefHash: hashBriefForRadar(BRIEF),
        acknowledgedAt: new Date(),
      };
      expect((await evaluateRiskRadarGate("brief-1", BRIEF)).ok).toBe(true);
    }
  });

  it("hash changes when any evaluated field changes", () => {
    const base = hashBriefForRadar(BRIEF);
    expect(hashBriefForRadar({ ...BRIEF, budgetRange: "1m-5m" })).not.toBe(base);
    expect(hashBriefForRadar({ ...BRIEF, scopeRequirements: "x" })).not.toBe(
      base,
    );
    // Stable for identical input.
    expect(hashBriefForRadar({ ...BRIEF })).toBe(base);
  });
});

describe("risk radar failure is persisted", () => {
  it("writes a failed report instead of dropping the run", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/actions/risk-radar.ts"),
      "utf8",
    );
    // The failure branch must persist before it throws, otherwise the
    // gate has no way to know the run happened at all.
    const failureBranch = src.slice(src.indexOf("if (!result.ok)"));
    expect(failureBranch).toContain('overall: "failed"');
    expect(failureBranch).toContain("failureReason");
    expect(failureBranch.indexOf("insertRow")).toBeLessThan(
      failureBranch.indexOf("fail({"),
    );
  });
});
