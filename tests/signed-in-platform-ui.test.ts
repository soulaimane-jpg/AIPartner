import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const shell = read("src/components/portal/portal-shell-client.tsx");
const rail = read("src/components/portal/portal-rail.tsx");
const topbar = read("src/components/portal/portal-topbar.tsx");
const globals = read("src/app/globals.css");
const marketingLayout = read("src/app/(marketing)/layout.tsx");
const authLayout = read("src/app/auth/layout.tsx");

const signedInRoots = [
  "src/app/admin/(portal)",
  "src/app/partner/(portal)",
  "src/app/google",
  "src/components/admin",
  "src/components/partner",
].map((path) => resolve(root, path));

const decorativePalette =
  /\b(?:bg|text|border|ring|from|to|via)-(?:indigo|violet|purple|cyan|sky|teal|pink|orange)-(?:50|100|200|300|400|500|600|700|800|900|950)\b|surface-cinema|cinema-bg/;

describe("shared signed-in platform UI", () => {
  it("uses the same light Google-blue appearance for every portal role", () => {
    expect(shell).toContain('const appearance = "platform" as const');
    expect(shell).not.toContain('user.role === "CUSTOMER" ? "customer"');
    expect(rail).toContain('appearance === "platform"');
    expect(topbar).toContain('appearance === "platform"');
    expect(globals).toContain('[data-portal-appearance="platform"]');
    expect(globals).not.toContain('[data-portal-appearance="customer"]');
  });

  it("keeps marketing and authentication outside the portal appearance", () => {
    expect(marketingLayout).not.toContain("PortalShell");
    expect(marketingLayout).not.toContain("data-portal-appearance");
    expect(authLayout).not.toContain("PortalShell");
    expect(authLayout).not.toContain("data-portal-appearance");
  });

  it("uses customer-style page hierarchy on representative role dashboards", () => {
    expect(read("src/app/admin/(portal)/page.tsx")).toContain("portal-page-header");
    expect(read("src/app/partner/(portal)/page.tsx")).toContain("PartnerPageHeader");
    expect(read("src/app/google/page.tsx")).toContain("portal-page-header");
    expect(read("src/app/admin/(portal)/briefs/page.tsx")).toContain("customer-table");
    expect(read("src/app/google/leads/page.tsx")).toContain("customer-table");
  });

  it("removes decorative accent families and cinema styling from signed-in role surfaces", () => {
    const offenders: string[] = [];
    for (const dir of signedInRoots) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        if (decorativePalette.test(text)) {
          offenders.push(file.replace(`${root}/`, ""));
        }
      }
    }
    expect(
      offenders,
      `Use primary/semantic status tokens in signed-in portals:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("applies the same scoped palette to the shell-free partner onboarding wizard", () => {
    const onboarding = read("src/app/partner/onboarding/page.tsx");
    expect(onboarding).toContain('className="portal-root');
    expect(onboarding).toContain('data-portal-appearance="platform"');
  });
});
