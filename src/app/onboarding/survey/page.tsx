import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { SurveyWizard } from "@/components/onboarding/survey-wizard";

export const metadata = { title: "Welcome · AI Partner" };
export const dynamic = "force-dynamic";

export default async function OnboardingSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; step?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?next=/onboarding/survey");
  }
  const { next, step } = await searchParams;
  const initialStep = step === "collaborators" ? "collaborators" : "survey";

  const user = await queryOne<{
    name: string | null;
    email: string;
    jobTitle: string | null;
    focusArea: string | null;
    surveyCompletedAt: Date | null;
    role: string;
    companyId: string | null;
  }>(
    `SELECT "name", "email", "jobTitle", "focusArea", "surveyCompletedAt",
            "role", "companyId"
     FROM "User" WHERE "id" = $1`,
    [session.user.id],
  );

  // Only the customer flow gets this wizard. Other roles bounce to their portal.
  if (!user || user.role !== "CUSTOMER") {
    redirect("/");
  }

  // Don't re-ask for identity we already captured at sign-up. The
  // credentials flow collects full name + role up front; Google OAuth
  // gives us a name but no role. Lock a field only when it's already known.
  const nameTokenCount = (user.name ?? "").trim().split(/\s+/).filter(Boolean).length;
  const lockName = nameTokenCount >= 2;
  const lockRole = !!(user.jobTitle && user.jobTitle.trim());

  return (
    <SurveyWizard
      initialName={user.name ?? ""}
      initialJobTitle={user.jobTitle ?? ""}
      initialFocusArea={user.focusArea ?? ""}
      initialEmail={user.email}
      needsCompany={!user.companyId}
      lockName={lockName}
      lockRole={lockRole}
      next={next}
      initialStep={initialStep}
    />
  );
}
