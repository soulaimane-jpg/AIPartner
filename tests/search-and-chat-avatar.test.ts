/**
 * Workspace search + AI-builder chat avatar.
 *
 * Two reported problems:
 *
 *  1. The ⌘K bar advertised "Search briefs, partners, actions…" but
 *     `PortalShellClient` never passed `recents`, so the palette only ever
 *     held static nav entries. Typing a brief title returned "No matches".
 *  2. The AI builder rendered a generic person glyph for the customer's own
 *     messages instead of their profile picture.
 *
 * The search half is security-sensitive: it is a name-lookup surface, and
 * partner identity is gated behind the reveal. A customer must get no
 * partner results at all.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const route = read("src/app/api/search/route.ts");
const palette = read("src/components/portal/command-palette.tsx");
const chat = read("src/components/brief-chat.tsx");
const builderPage = read("src/app/(portal)/briefs/[id]/builder/page.tsx");
const builderClient = read("src/components/brief-builder-client.tsx");

describe("search endpoint — tenancy", () => {
  it("requires a session", () => {
    expect(route).toContain("Sign in required");
    expect(route).toContain("401");
  });

  it("scopes customer results to briefs they can already open", () => {
    // Owner, same company, or an explicit collaborator grant — never a bare
    // title match across the table.
    const customerBranch = route.slice(route.indexOf("// CUSTOMER / COLLABORATOR"));
    expect(customerBranch).toContain('b."ownerId" = $1');
    expect(customerBranch).toContain('b."companyId" = $4');
    expect(customerBranch).toContain('"BriefCollaborator"');
  });

  it("scopes partner results to their own matches", () => {
    const partnerBranch = route.slice(
      route.indexOf('role === "PARTNER"'),
      route.indexOf('role === "GOOGLER"'),
    );
    expect(partnerBranch).toContain('m."partnerId" = $1');
  });

  it("scopes googler results to their own referrals", () => {
    const googlerBranch = route.slice(
      route.indexOf('role === "GOOGLER"'),
      route.indexOf("// CUSTOMER / COLLABORATOR"),
    );
    expect(googlerBranch).toContain('"googlerId" = $1');
  });

  it("escapes LIKE wildcards so input cannot widen the match", () => {
    // A bare `%` would otherwise match every row in the table.
    expect(route).toContain("function likeTerm");
    expect(route).toMatch(/replace\(\/\[\\\\%_\]\/g/);
    expect(route).toContain("ESCAPE");
  });

  it("is rate limited", () => {
    expect(route).toContain("checkRateLimit");
    expect(route).toContain("429");
  });

  it("ignores very short queries", () => {
    expect(route).toContain("q.length < 2");
  });
});

describe("search endpoint — identity firewall", () => {
  it("returns partner companies only to admins", () => {
    // The one query that selects partner Company rows must sit inside the
    // ADMIN branch.
    const adminBranch = route.slice(
      route.indexOf('role === "ADMIN"'),
      route.indexOf('role === "PARTNER"'),
    );
    expect(adminBranch).toContain(`"kind" = 'PARTNER'`);

    const nonAdmin = route.slice(route.indexOf('role === "PARTNER"'));
    expect(
      nonAdmin,
      "a non-admin branch selects partner companies — that is a pre-reveal identity leak",
    ).not.toContain(`"kind" = 'PARTNER'`);
  });

  it("never selects Company.name outside the admin branch", () => {
    const nonAdmin = route.slice(route.indexOf('role === "PARTNER"'));
    expect(nonAdmin).not.toMatch(/FROM "Company"/);
  });

  it("documents why customers get no partner results", () => {
    expect(route).toContain("gated behind the reveal");
  });
});

describe("command palette wiring", () => {
  it("queries the server as you type, debounced", () => {
    expect(palette).toContain("/api/search?q=");
    expect(palette).toContain("setTimeout");
    expect(palette).toContain("AbortController");
  });

  it("ignores a stale response that lands after a newer one", () => {
    // Without this, typing fast can leave results for an earlier prefix.
    expect(palette).toContain("requestSeq");
    expect(palette).toContain("seq === requestSeq.current");
  });

  it("still filters the static nav entries locally", () => {
    // cmdk's own filter is off so server hits are never filtered back out;
    // the static entries must therefore be narrowed by hand.
    expect(palette).toContain("shouldFilter={false}");
    expect(palette).toContain("staticEntries");
    expect(palette).toContain("needle");
  });

  it("renders a Results group above the static ones", () => {
    expect(palette).toMatch(
      /\["Results", "Recent", "Navigate", "Actions", "Switch view"\]/,
    );
  });

  it("resets between openings", () => {
    expect(palette).toMatch(/if \(!open\)[\s\S]{0,120}setTerm\(""\)/);
  });

  it("shows searching and no-match states rather than a bare empty list", () => {
    expect(palette).toContain("Searching…");
    expect(palette).toContain("No matches for");
  });

  it("no longer promises to search things a role cannot search", () => {
    // A customer cannot search partners, so don't advertise it to them.
    expect(palette).toContain("Search your briefs, actions…");
    expect(palette).toContain("Search briefs, partners, people…");
  });
});

describe("AI builder chat avatar", () => {
  it("renders the viewer's real avatar for their own messages", () => {
    expect(chat).toContain("ChatAvatar");
    expect(chat).toContain('from "@/components/ui/avatar"');
    expect(chat).toMatch(/<UserAvatar[\s\S]{0,120}src=\{viewer\.image\}/);
  });

  it("falls back to initials, not the anonymous glyph, when there is no photo", () => {
    // `Avatar` derives initials + a deterministic colour from the name.
    const avatar = read("src/components/ui/avatar.tsx");
    expect(avatar).toContain("initialsOf");
    expect(avatar).toContain("gradientFor");
  });

  it("keeps the assistant mark for assistant turns", () => {
    expect(chat).toContain('if (!isUser) return <AssistantMark size="sm" />');
  });

  it("threads the viewer from the server page through to the chat", () => {
    expect(builderPage).toContain("viewer={viewer}");
    expect(builderClient).toContain("viewer?: ChatViewer");
    expect(builderClient).toContain("viewer={viewer}");
  });

  it("resolves GCS-backed avatars through the signed-URL route", () => {
    // Storing `gcs:<path>` and rendering it directly would be a broken image.
    expect(builderPage).toContain('startsWith("gcs:")');
    expect(builderPage).toContain("/api/account/avatar");
  });

  it("reads the image from the User row so a new upload shows immediately", () => {
    // The session snapshot can be stale until the next sign-in.
    expect(builderPage).toMatch(/SELECT "name", "email", "image" FROM "User"/);
  });
});
