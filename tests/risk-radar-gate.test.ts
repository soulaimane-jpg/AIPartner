/**
 * Risk Radar gate — end-to-end coherence.
 *
 * Making the gate fail-closed introduced a failure mode far worse than the
 * bug it fixed: if the three places that touch the brief hash (the action
 * that writes reports, the gate that reads them, the page that renders the
 * card) disagree about which fields to read, every report looks
 * permanently stale and NOBODY can submit a brief.
 *
 * It also required the Risk Radar UI to actually exist. `RiskRadarCard`
 * was dead code — defined but rendered nowhere — so the first version of
 * the fail-closed gate was unsatisfiable in production. These tests pin
 * both properties.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  query: () => Promise.resolve([]),
  queryOne: () => Promise.resolve(null),
}));

const { hashBriefForRadar, RADAR_BRIEF_COLUMNS } = await import(
  "@/lib/risk-radar"
);

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const previewPage = read("src/app/(portal)/briefs/[id]/preview/page.tsx");
const card = read("src/components/brief/risk-radar-card.tsx");
const action = read("src/lib/actions/risk-radar.ts");
const gate = read("src/lib/risk-radar.ts");

/** Column names declared in the shared SELECT fragment. */
function declaredColumns(): string[] {
  return [...RADAR_BRIEF_COLUMNS.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
}

describe("hash reads exactly the columns that are selected", () => {
  it("touches no field outside RADAR_BRIEF_COLUMNS", () => {
    // Record real property access rather than pattern-matching source: if
    // someone adds a field to the hash and forgets the SELECT, this fails.
    const touched = new Set<string>();
    const spy = new Proxy(
      {},
      {
        get(_t, prop: string) {
          touched.add(prop);
          return "v";
        },
      },
    );

    hashBriefForRadar(spy as never);

    const declared = new Set(declaredColumns());
    const missingFromSelect = [...touched].filter((k) => !declared.has(k));
    expect(
      missingFromSelect,
      `hashBriefForRadar reads these but RADAR_BRIEF_COLUMNS doesn't select them: ${missingFromSelect.join(", ")}`,
    ).toEqual([]);
  });

  it("selects nothing it doesn't hash — a stray column would still be fine, but flag drift", () => {
    const touched = new Set<string>();
    hashBriefForRadar(
      new Proxy(
        {},
        {
          get(_t, prop: string) {
            touched.add(prop);
            return "v";
          },
        },
      ) as never,
    );
    for (const col of declaredColumns()) {
      expect(touched.has(col), `${col} is selected but never hashed`).toBe(true);
    }
  });

  it("all three call sites use the shared column list and helper", () => {
    expect(action).toContain("RADAR_BRIEF_COLUMNS");
    expect(action).toContain("hashBriefForRadar");
    expect(gate).toContain("RADAR_BRIEF_COLUMNS");
    expect(gate).toContain("hashBriefForRadar");
    expect(previewPage).toContain("hashBriefForRadar(brief)");
    // And none of them keeps a private copy of the column list.
    expect(
      (action.match(/"executiveSummary"/g) ?? []).length,
      "risk-radar action still has an inline column list",
    ).toBe(0);
  });

  it("is stable for equal input and changes for any hashed field", () => {
    const base = {
      title: "T",
      executiveSummary: "E",
      scopeRequirements: "S",
      integrationPoints: "I",
      dataSources: "D",
      successCriteria: "C",
      targetGoLive: "2026-01-01",
      budgetRange: "100k",
      preferredLocation: "EU",
      requiredCertifications: "ISO",
    };
    const h = hashBriefForRadar(base);
    expect(hashBriefForRadar({ ...base })).toBe(h);
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      expect(
        hashBriefForRadar({ ...base, [key]: "CHANGED" }),
        `${key} does not affect the hash`,
      ).not.toBe(h);
    }
  });

  it("treats null and empty string as different — a cleared field is a change", () => {
    const base = {
      title: "T",
      executiveSummary: null,
      scopeRequirements: null,
      integrationPoints: null,
      dataSources: null,
      successCriteria: null,
      targetGoLive: null,
      budgetRange: null,
      preferredLocation: null,
      requiredCertifications: null,
    };
    expect(hashBriefForRadar({ ...base, budgetRange: "" })).not.toBe(
      hashBriefForRadar(base),
    );
  });
});

describe("the gate is satisfiable — the UI exists and is mounted", () => {
  it("RiskRadarCard is rendered on the page that hosts the submit button", () => {
    // It was dead code: defined, exported, imported nowhere. A fail-closed
    // gate with no way to run the check blocks every submission.
    expect(previewPage).toContain("<RiskRadarCard");
    expect(previewPage).toContain('from "@/components/brief/risk-radar-card"');
    // Mounted inside the submit section, not somewhere the owner can't see.
    const submitIdx = previewPage.indexOf('id="submit"');
    const cardIdx = previewPage.indexOf("<RiskRadarCard");
    expect(submitIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(submitIdx);
  });

  it("the page loads a snapshot and computes staleness the same way the gate does", () => {
    expect(previewPage).toContain('FROM "RiskRadarReport"');
    expect(previewPage).toContain("stale: radarRow.briefHash !== hashBriefForRadar(brief)");
  });

  it("surfaces every gate condition as a visible blocker", () => {
    for (const copy of [
      "Run the pre-submit review",
      "Re-run Risk Radar",
      "didn't complete",
      "acknowledge the Risk Radar blockers",
    ]) {
      expect(previewPage, `missing blocker copy: ${copy}`).toContain(copy);
    }
  });

  it("the card can run, re-scan and acknowledge", () => {
    expect(card).toContain("runRiskRadarAction");
    expect(card).toContain("acknowledgeRiskRadarAction");
    expect(card).toContain("Re-scan");
  });

  it("the card understands the failed and stale states the gate can produce", () => {
    expect(card).toContain('"failed"');
    expect(card).toContain("stale");
    // A failed run must be acknowledgeable, else an AI outage is a hard stop.
    expect(card).toMatch(
      /needsAck[\s\S]{0,160}overall === "failed"/,
    );
  });
});

describe("gate verdicts stay aligned with the UI", () => {
  it("every verdict kind the gate returns has matching UI copy", () => {
    // missing | stale | failed | blocked
    for (const kind of ["missing", "stale", "failed", "blocked"]) {
      expect(gate, `gate lost the ${kind} verdict`).toContain(`"${kind}"`);
    }
  });

  it("an acknowledged block or failure is allowed through", () => {
    expect(gate).toContain("acknowledgedAt");
    // Both branches check acknowledgement rather than hard-failing.
    expect(gate).toMatch(/overall === "failed" && !latest\.acknowledgedAt/);
    expect(gate).toMatch(/overall === "block" && !latest\.acknowledgedAt/);
  });
});
