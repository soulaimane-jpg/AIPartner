/**
 * Authorization coverage.
 *
 * Middleware maps path prefixes to roles and the portal layouts pass
 * `allow` lists to `PortalShell`, so admin pages were covered twice —
 * but both layers are routing configuration. Rename a route group, add a
 * page outside one, or edit the matcher, and the gate disappears with no
 * test failing. These tests make that failure loud.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

function pagesUnder(dir: string): string[] {
  const abs = resolve(root, dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.tsx") out.push(full.replace(`${root}/`, ""));
    }
  };
  walk(abs);
  return out;
}

describe("admin surface", () => {
  const pages = pagesUnder("src/app/admin/(portal)");

  it("has pages to check", () => {
    expect(pages.length).toBeGreaterThan(15);
  });

  it("every page enforces the ADMIN role locally", () => {
    const missing = pages.filter((p) => !read(p).includes("requireAdmin("));
    expect(
      missing,
      `Add \`await requireAdmin()\` (from @/lib/require-role):\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("still has the layout and middleware layers", () => {
    expect(read("src/app/admin/(portal)/layout.tsx")).toContain(
      'allow={["ADMIN"]}',
    );
    expect(read("src/middleware.ts")).toContain("/admin");
  });
});

describe("googler surface", () => {
  const pages = pagesUnder("src/app/google");

  it("every page enforces the GOOGLER/ADMIN role locally", () => {
    const missing = pages.filter((p) => !read(p).includes("requireGoogler("));
    expect(
      missing,
      `Add \`await requireGoogler()\` (from @/lib/require-role):\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("still has the layout layer", () => {
    expect(read("src/app/google/layout.tsx")).toContain(
      'allow={["GOOGLER", "ADMIN"]}',
    );
  });
});

describe("partner-scoped API routes", () => {
  it("/api/partner/tags checks role, not just a session", () => {
    const src = read("src/app/api/partner/tags/route.ts");
    // Session-only meant any customer/collaborator/googler could
    // enumerate the tag library that match-score-v2 scores against.
    expect(src).toContain('role !== "PARTNER"');
    expect(src).toContain('role !== "ADMIN"');
    expect(src).toContain("403");
  });

  it("every /api/partner route checks a role", () => {
    const routes = pagesUnder("src/app/api/partner")
      .concat(
        (function walk(dir: string, out: string[] = []): string[] {
          const abs = resolve(root, dir);
          for (const entry of readdirSync(abs)) {
            const full = join(abs, entry);
            if (statSync(full).isDirectory()) walk(full.replace(`${root}/`, ""), out);
            else if (entry === "route.ts") out.push(full.replace(`${root}/`, ""));
          }
          return out;
        })("src/app/api/partner"),
      )
      .filter((p) => p.endsWith("route.ts"));

    const missing = routes.filter((p) => {
      const src = read(p);
      return !/role !== "PARTNER"|role !== "ADMIN"|requirePartner|PARTNER_ROLES/.test(
        src,
      );
    });
    expect(
      missing,
      `Partner API routes must gate on role:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});

describe("requireRole helper", () => {
  const src = read("src/lib/require-role.ts");

  it("redirects rather than rendering for the wrong role", () => {
    expect(src).toContain("redirect(signInPath)");
  });

  it("sends admins to the admin login, partners to the partner login", () => {
    expect(src).toContain('signInPath: "/admin/login"');
    expect(src).toContain('signInPath: "/partner/login"');
  });

  it("defaults an absent role to the least-privileged one", () => {
    // A session without an explicit role must not fall through as admin.
    expect(src).toContain('session.user.role ?? "CUSTOMER"');
  });
});
