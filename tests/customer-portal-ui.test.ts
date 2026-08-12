import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const shell = read("src/components/portal/portal-shell-client.tsx");
const serverShell = read("src/components/portal/portal-shell.tsx");
const rail = read("src/components/portal/portal-rail.tsx");
const topbar = read("src/components/portal/portal-topbar.tsx");
const nav = read("src/components/portal/portal-nav-config.ts");
const account = read("src/app/account/page.tsx");
const workspace = read("src/app/(portal)/dashboard/_components/workspace-client.tsx");
const briefs = read("src/app/(portal)/briefs/page.tsx");
const profile = read("src/app/(portal)/profile/page.tsx");
const wizard = read("src/components/qualification-wizard.tsx");
const newBrief = read("src/app/(portal)/briefs/new/page.tsx");
const bookCall = read("src/app/(portal)/briefs/new-call/book-call-form.tsx");
const templates = read("src/app/(portal)/templates/page.tsx");
const briefHeader = read("src/components/brief-workspace-header.tsx");
const briefDrawer = read("src/app/(portal)/dashboard/_components/brief-drawer.tsx");

describe("customer portal UI", () => {
  it("uses one responsive light shell across every signed-in platform", () => {
    expect(shell).toContain('const appearance = "platform" as const');
    expect(shell).toContain('data-portal-appearance={appearance}');
    expect(shell).toContain('className="portal-content');
    expect(shell).toContain("onOpenMobileNav");
    expect(rail).toContain("<Sheet open={mobileOpen}");
    expect(rail).toContain('aria-current={active ? "page" : undefined}');
    expect(rail).toContain('appearance === "platform"');
    expect(rail).toContain('border-slate-200/80 bg-white text-slate-900');
  });

  it("keeps notifications and account controls functional", () => {
    expect(topbar).toContain("notifications.map");
    expect(topbar).toContain('href={accountHref}');
    expect(topbar).toContain("onSignOut()");
    expect(account).toContain('href="/account/security"');
    expect(account).toContain('href: "/profile"');
  });

  it("normalizes customer settings navigation and decision badges", () => {
    expect(nav).toContain('{ href: "/account", label: "Settings"');
    expect(serverShell).not.toContain("REVIEW_PROPOSALS");
    expect(serverShell).toContain("p.\"releasedAt\" IS NOT NULL");
  });

  it("uses consistent customer page hierarchy and responsive list patterns", () => {
    expect(workspace).toContain("portal-page");
    expect(profile).toContain("portal-page-header");
    expect(briefs).toContain('className="grid gap-3 md:hidden"');
    expect(briefs).toContain("min-w-[760px]");
    expect(templates).toContain('className="divide-y divide-border md:hidden"');
  });

  it("keeps brief navigation canonical and human readable", () => {
    expect(briefs).toContain("/preview");
    expect(briefDrawer).toContain("/preview");
    expect(briefHeader).toContain('{ label: title, href: `/briefs/${briefId}/preview` }');
    expect(briefHeader).not.toContain("{ label: briefId");
  });

  it("uses the customer platform treatment across creation workflows", () => {
    expect(newBrief).toContain("portal-page-header");
    expect(wizard).toContain("bg-blue-600");
    expect(wizard).toContain("aria-live=\"polite\"");
    expect(bookCall).toContain("aria-busy={pending || undefined}");
    expect(bookCall).toContain("bg-primary/10");
    expect(bookCall).toContain("focus:ring-primary/15");
  });
});
