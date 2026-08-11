import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const profilePage = read("src/app/(portal)/profile/page.tsx");
const profileForm = read("src/components/account-profile-form.tsx");
const profileActions = read("src/lib/actions/account-profile.ts");
const avatarRoute = read("src/app/api/account/avatar/route.ts");
const meetingDialog = read("src/components/customer/schedule-meeting-dialog.tsx");
const builder = read("src/components/brief-builder-client.tsx");
const workspaceHeader = read("src/components/brief-workspace-header.tsx");
const portalShell = read("src/components/portal/portal-shell.tsx");

describe("customer account and workspace experience", () => {
  it("provides complete personal profile and sign-in management", () => {
    expect(profilePage).toContain("AccountProfileForm");
    expect(profileForm).toContain("Personal information");
    expect(profileForm).toContain("Sign-in & security");
    expect(profileForm).toContain("Update password");
    expect(profileForm).toContain("Advanced security");
  });

  it("keeps private avatar uploads authenticated and constrained", () => {
    expect(profileActions).toContain("await auth()");
    expect(profileActions).toContain("1024 * 1024");
    expect(profileActions).toContain('"image/jpeg"');
    expect(profileActions).toContain('"image/png"');
    expect(profileActions).toContain('"image/webp"');
    expect(profileActions).toContain("avatars/${session.user.id}");
    expect(avatarRoute).toContain("session.user.id");
    expect(avatarRoute).toContain('"Content-Disposition": "inline"');
    expect(portalShell).toContain('"/api/account/avatar"');
  });

  it("uses the customer visual system in the meeting dialog", () => {
    expect(meetingDialog).toContain("IconTile");
    expect(meetingDialog).toContain("bg-primary/5");
    expect(meetingDialog).not.toContain("emerald");
    expect(meetingDialog).toContain("sm:grid-cols-[minmax(0,1.3fr)_minmax(150px,0.7fr)]");
  });

  it("keeps the brief builder contained and responsive", () => {
    expect(workspaceHeader).toContain("rounded-2xl border border-border bg-card/95");
    expect(builder).toContain("xl:grid-cols-[minmax(0,1fr)_320px]");
    expect(builder).toContain("xl:hidden");
    expect(builder).toContain("Brief readiness");
  });
});
