/**
 * Lead pipeline invariants.
 *
 * The core structural bug this guards: `ProjectBrief.stage` and
 * `ProjectBrief.leadState` used to be written independently, from ≥11
 * places, so the customer pipeline widget and the admin state gate
 * could disagree about where a brief was. `transitionLead` is now the
 * only writer of `stage`, and this suite fails the build if a new
 * direct write appears.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { LEAD_STATES } from "@/lib/enums";
import { LEAD_STATE_LABELS } from "@/lib/constants";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Files allowed to write `stage`:
 *   - the state machine itself (it derives `stage` from `leadState`)
 *   - brief creation, which inserts the initial INTAKE/DRAFT pair
 *   - the sandbox seeder, which fabricates whole briefs
 */
const WRITE_ALLOWLIST = [
  "src/lib/state-machine/lead.ts",
  "src/lib/actions/briefs.ts", // creation insert only — asserted below
  "src/lib/actions/brief-call.ts", // creation insert only
  "src/lib/sandbox.ts",
];

describe("stage is written only by the state machine", () => {
  const files = walk(SRC).filter((f) => /\.tsx?$/.test(f));

  it("has no SQL that assigns to the stage column", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (WRITE_ALLOWLIST.includes(rel)) continue;
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        // `SET "stage" = …` in raw SQL.
        if (/SET\s+"stage"\s*=/i.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      "Use transitionLead()/advanceLeadIfAllowed() instead of writing `stage` " +
        `directly:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("has no updateRows call that sets stage", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd() + "/", "");
      if (WRITE_ALLOWLIST.includes(rel)) continue;
      const text = readFileSync(file, "utf8");
      // `updateRows("ProjectBrief", …, { … stage: … })` across lines.
      const re = /updateRows\(\s*["']ProjectBrief["'][\s\S]{0,400}?\}\s*\)/g;
      for (const match of text.match(re) ?? []) {
        if (/\bstage\s*:/.test(match)) {
          offenders.push(`${rel}  ${match.slice(0, 120).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(
      offenders,
      `updateRows must not set \`stage\`:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("only writes stage at brief creation in the allowlisted action files", () => {
    for (const rel of [
      "src/lib/actions/briefs.ts",
      "src/lib/actions/brief-call.ts",
    ]) {
      const text = readFileSync(join(process.cwd(), rel), "utf8");
      const assignments = text.match(/\bstage:\s*"[A-Z_]+"/g) ?? [];
      // Exactly one: the INTAKE insert when the brief is created.
      expect(assignments, `${rel} should only set stage on insert`).toEqual([
        'stage: "INTAKE"',
      ]);
    }
  });
});

describe("lead state definitions stay in sync", () => {
  it("labels every lead state", () => {
    for (const state of LEAD_STATES) {
      expect(LEAD_STATE_LABELS[state], `missing label for ${state}`).toBeTruthy();
    }
  });

  it("labels nothing that is not a lead state", () => {
    for (const key of Object.keys(LEAD_STATE_LABELS)) {
      expect(LEAD_STATES as readonly string[]).toContain(key);
    }
  });
});
