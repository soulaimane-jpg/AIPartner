import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { OnboardingWizard } from "@/components/partner/onboarding-wizard";
import { loadPartnerPillarState } from "@/lib/partner-pillar-load";

export const dynamic = "force-dynamic";

/**
 * First-run intake, deliberately outside the `(portal)` group.
 *
 * The portal shell carries a sidebar, metrics and navigation — all of which are
 * noise during setup and all of which invite the partner to wander off before
 * finishing. A bare full-width route keeps the wizard the only thing on screen.
 */
export default async function PartnerOnboardingPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/partner/login");
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    redirect("/partner/login");
  }

  const company = await queryOne<{ id: string; name: string }>(
    'SELECT "id", "name" FROM "Company" WHERE "id" = $1',
    [session.user.companyId],
  );
  if (!company) redirect("/partner/login");

  const state = await loadPartnerPillarState(company.id);

  // Re-running a completed wizard would let a partner reset their own
  // verification timestamp; send them to the editor instead.
  if (state.onboardingCompleted) redirect("/partner/profile");

  return (
    <div className="portal-root min-h-screen bg-background" data-portal-appearance="platform">
      <div className="page-container px-4 sm:px-6">
        <OnboardingWizard
          initialValues={state.values}
          initialTagLabels={state.tagLabels}
          companyName={company.name}
          initialStep={state.onboardingStep}
          directoryUrl={state.profile?.directoryUrl ?? ""}
          website={state.profile?.website ?? ""}
        />
      </div>
    </div>
  );
}
