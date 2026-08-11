import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

/**
 * Partner portal shell, with a first-run onboarding gate.
 *
 * The gate only fires for partners who have **never touched** the wizard —
 * `onboardingStep IS NULL` and not yet completed. Once they interact with it at
 * all (including pressing "Finish later", which stamps `skipped`), the gate
 * releases permanently and `OnboardingBanner` takes over the nudging.
 *
 * Gating on `onboardingCompletedAt` alone would trap anyone who chose to finish
 * later: they'd land on the portal, get bounced back to the wizard, press
 * "Finish later" again, and loop. Tracking engagement rather than completion is
 * what makes the escape hatch actually work.
 *
 * `/partner/onboarding` deliberately sits outside this route group, so the
 * redirect target is never itself gated.
 */
export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Only gate real partners. Admins impersonating the portal, and unauthorised
  // visitors, are handled by PortalShell itself.
  if (session?.user?.role === "PARTNER" && session.user.companyId) {
    const profile = await queryOne<{
      onboardingCompletedAt: Date | null;
      onboardingStep: string | null;
    }>(
      'SELECT "onboardingCompletedAt", "onboardingStep" FROM "PartnerProfile" WHERE "companyId" = $1',
      [session.user.companyId],
    );

    const neverStarted =
      !profile || (!profile.onboardingCompletedAt && !profile.onboardingStep);
    if (neverStarted) redirect("/partner/onboarding");
  }

  return (
    <PortalShell allow={["PARTNER", "ADMIN"]} signInRedirect="/partner/login">
      {children}
    </PortalShell>
  );
}
