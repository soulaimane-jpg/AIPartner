/**
 * Identity firewall as a STRUCTURAL boundary, not a library.
 *
 * `firewall.ts` was well designed but only two files imported it, so
 * nothing stopped the next customer-facing page from joining
 * `Company`/`PartnerProfile` and rendering a partner's real name
 * pre-reveal. That is exactly how the shortlist leak happened.
 *
 * This suite fails the build when a customer-facing server component
 * selects partner-identifying columns without going through
 * `isPartnerRevealed()` / a serializer. It is deliberately crude: a
 * false positive costs one allowlist entry plus a justification, while
 * a false negative ships a confidentiality breach.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Customer-facing surfaces. Admin, partner and Googler routes sit
 * INSIDE the firewall and may read identity freely.
 */
const CUSTOMER_ROOTS = [
  join(SRC, "app", "(portal)"),
  join(SRC, "app", "account"),
];

/** SQL that pulls a partner's identity into a customer-facing read. */
const PARTNER_IDENTITY_SQL = [
  /c\."name"\s+AS\s+"partnerName"/i,
  /pp\."logoUrl"/i,
  /pp\."directoryUrl"/i,
  /pp\."leadRoutingEmail"/i,
  /pp\."keyClients"/i,
  /"PartnerContact"/i,
];

/** Evidence that the file gates identity properly. */
const GATE_MARKERS = [
  "isPartnerRevealed",
  "serializeCompanyFacingProposal",
  "serializeCompanyFacingShortlistCard",
];

describe("identity firewall boundary", () => {
  const files = CUSTOMER_ROOTS.flatMap((root) => walk(root));

  it("finds customer-facing files to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("gates every customer-facing read of partner identity", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const touchesIdentity = PARTNER_IDENTITY_SQL.some((re) => re.test(text));
      if (!touchesIdentity) continue;

      const gated = GATE_MARKERS.some((marker) => text.includes(marker));
      if (!gated) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }

    expect(
      offenders,
      "These customer-facing files read partner-identifying columns without " +
        "isPartnerRevealed()/a firewall serializer. Route them through " +
        `src/lib/serializers/firewall.ts:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the raw partner name out of customer-facing JSX", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // `{x.partnerName}` rendered directly — the serializers expose
      // `displayLabel` / `revealedPartnerName` instead.
      if (/\{\s*[\w.]*\bpartnerName\b\s*\}/.test(text)) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }
    expect(
      offenders,
      `Render displayLabel/revealedPartnerName, never a raw partnerName:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
