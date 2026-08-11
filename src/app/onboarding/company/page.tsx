import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { CustomerProfileRow } from "@/lib/db/rows";
import { CompanyQuestionsForm } from "./company-questions-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "About your GCP setup · AI Partner" };

/**
 * M2 — company onboarding clarification questions (plan-A).
 * Every question is individually skippable; answers are editable later
 * from company settings. Skips are tracked so the AIPartner team can
 * follow up.
 */
export default async function CompanyOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/onboarding/company");
  if (session.user.role !== "CUSTOMER") redirect("/dashboard");

  const companyId = session.user.companyId;
  if (!companyId) redirect("/onboarding/survey");

  const profile = await queryOne<CustomerProfileRow>(
    'SELECT * FROM "CustomerProfile" WHERE "companyId" = $1',
    [companyId],
  );

  return (
    <main className="min-h-screen bg-secondary/30 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            A few questions about your Google Cloud setup
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            These help us match you with the right partners and spot better
            commercial terms. Each one is optional — skip anything you&apos;re
            not sure about.
          </p>
        </div>
        <CompanyQuestionsForm
          initial={{
            gcpAgreementStatus: profile?.gcpAgreementStatus ?? null,
            gcpContractEndDate: profile?.gcpContractEndDate
              ? profile.gcpContractEndDate.toISOString().slice(0, 10)
              : null,
            gcpDiscountPct: profile?.gcpDiscountPct ?? null,
            resellInterest: profile?.resellInterest ?? null,
            employeeCountBand: profile?.employeeCountBand ?? null,
          }}
          nextHref="/onboarding/tutorial"
        />
      </div>
    </main>
  );
}
