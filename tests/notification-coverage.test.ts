/**
 * Notification delivery coverage.
 *
 * Two notification paths used to coexist: `notify()` (renders a
 * DB-overridable template, writes the in-app row AND enqueues email)
 * and a direct `insertRow("Notification", …)` (in-app badge only, no
 * email, ever). Fifteen lifecycle events took the second path, so
 * customers and partners silently never heard about them.
 *
 * These tests keep the codebase on the single path and keep the event
 * registry consistent.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NOTIFICATION_EVENTS } from "@/lib/notify";

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
 * Files still allowed to insert a Notification row directly.
 *
 * `notify.ts` is the implementation. `outreach.ts` sends its own email
 * alongside the row, so the recipient is not left in silence. The two
 * fan-out helpers own their own recipient resolution and are
 * in-app-by-design nudges rather than lifecycle events.
 */
const ALLOWLIST = new Set([
  "src/lib/notify.ts",
  "src/lib/email/outreach.ts",
  "src/lib/actions/comments.ts",
  "src/lib/actions/meetings.ts",
  "src/lib/actions/onboarding.ts",
  "src/app/api/onboarding/skip-survey/route.ts",
]);

describe("notification delivery", () => {
  it("routes lifecycle events through notify() rather than raw inserts", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.replace(process.cwd() + "/", "");
      if (ALLOWLIST.has(rel)) continue;
      const text = readFileSync(file, "utf8");
      if (/insertRow\(\s*["']Notification["']/.test(text)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      "These write in-app notifications directly, so the recipient never " +
        `gets an email. Use notify()/notifyAdmins():\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("notification event registry", () => {
  const events = Object.entries(NOTIFICATION_EVENTS);

  it("gives every event a subject, body and description", () => {
    for (const [key, def] of events) {
      expect(def.subject, `${key} subject`).toBeTruthy();
      expect(def.body, `${key} body`).toBeTruthy();
      expect(def.description, `${key} description`).toBeTruthy();
    }
  });

  /**
   * Terminal events have nowhere useful to send the reader — an
   * expired invite or a lost bid has no actionable page — so they are
   * allowed to omit the CTA.
   */
  const NO_CTA = new Set([
    "invite.expired",
    "proposal.expired",
    "partner.not_selected",
  ]);

  it("gives every actionable event a CTA link", () => {
    const missing = events
      .filter(([key, def]) => !NO_CTA.has(key) && !def.body.includes("{{link}}"))
      .map(([key]) => key);
    expect(
      missing,
      `Add {{link}} or add to NO_CTA:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("uses only placeholder syntax that render() understands", () => {
    // render() replaces /\{\{(\w+)\}\}/ — anything else silently ships
    // literal braces to the recipient.
    const bad: string[] = [];
    for (const [key, def] of events) {
      for (const text of [def.subject, def.body]) {
        for (const m of text.match(/\{\{[^}]*\}\}/g) ?? []) {
          if (!/^\{\{\w+\}\}$/.test(m)) bad.push(`${key}: ${m}`);
        }
      }
    }
    expect(bad, `Malformed placeholders:\n${bad.join("\n")}`).toEqual([]);
  });
});
