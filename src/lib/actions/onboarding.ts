"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { queryOne, insertRow, updateRows, tx } from "@/lib/db";
import { CHALLENGE_AREA_KEYS } from "@/lib/challenge-areas";

/**
 * Onboarding flow:
 *   1. Survey       — capture jobTitle (role) + focusArea
 *   2. Collaborators (optional second step) — see actions/collaborators.ts
 *   3. Tutorial overlay — sets onboardedAt
 *
 * Every action redirects to `next` (defaults to `/dashboard`) so the
 * wizard can chain steps and customers land on the right place after.
 */

const surveySchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  jobTitle: z.string().min(2, "Role helps us tailor partner matches"),
  challengeAreas: z.array(z.enum(CHALLENGE_AREA_KEYS)).min(1, "Select at least one challenge").max(5),
  /**
   * Required only when the signed-in CUSTOMER has no `companyId` yet —
   * e.g. they signed up via Google OAuth, which doesn't collect a company
   * name. The credentials sign-up form captures it up front, so this
   * stays optional in the schema and is enforced inside the action.
   */
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(120, "Company name is too long")
    .optional(),
  next: z.string().optional(),
});

export type OnboardingState = { error?: string } | undefined;

export async function completeSurveyAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?next=/onboarding/survey");
  }

  const parsed = surveySchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    jobTitle: formData.get("jobTitle"),
    challengeAreas: formData.getAll("challengeAreas"),
    companyName: (formData.get("companyName") || undefined) as
      | string
      | undefined,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { firstName, lastName, jobTitle, challengeAreas, companyName, next } = parsed.data;
  const name = `${firstName} ${lastName}`;

  // Look up the current user so we can decide whether the company
  // creation branch must run (Google OAuth customers arrive here with
  // companyId === null).
  const me = await queryOne<{ companyId: string | null; role: string }>(
    'SELECT "companyId", "role" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  if (!me) {
    redirect("/auth/sign-in?next=/onboarding/survey");
  }

  // CUSTOMER without a Company must provide a name — this is the
  // signup-time invariant for credentials users, enforced here for the
  // OAuth path.
  if (me.role === "CUSTOMER" && !me.companyId && !companyName) {
    return { error: "Company name is required" };
  }

  await tx(async (client) => {
    let companyId = me.companyId;
    if (!companyId && companyName) {
      const company = await insertRow<{ id: string }>(
        "Company",
        { name: companyName, kind: "CUSTOMER" },
        { client },
      );
      companyId = company.id;
      // The creator of a brand-new company is its workspace OWNER
      // (OAuth sign-up path — credentials sign-up handles this at signup).
      await insertRow(
        "WorkspaceMembership",
        {
          companyId: company.id,
          userId: session.user.id,
          role: "OWNER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
        { client },
      );
    }
    await updateRows(
      "User",
      { id: session.user.id },
      {
        name,
        firstName,
        lastName,
        jobTitle,
        challengeAreas: JSON.stringify(challengeAreas),
        surveyCompletedAt: new Date(),
        ...(companyId && companyId !== me.companyId ? { companyId } : {}),
      },
      { client },
    );
  });

  revalidatePath("/dashboard");
  // plan-A M2: customers see the company clarification questions
  // (GCP agreement, discount, resell interest) before the tutorial.
  redirect(next ?? "/onboarding/company");
}

/**
 * "Do this later" — stamps surveyCompletedAt to avoid nagging the user,
 * leaves focusArea/jobTitle untouched.
 */
export async function skipSurveyAction(next?: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  await updateRows(
    "User",
    { id: session.user.id },
    { surveyCompletedAt: new Date() },
  );

  // Leave a notification so they remember to fill it in.
  await insertRow("Notification", {
    userId: session.user.id,
    type: "onboarding.survey_skipped",
    title: "Finish your profile when you have a minute",
    message:
      "Telling us your focus area helps us match you with the right partners faster.",
    link: "/onboarding/survey",
  });

  redirect(next ?? "/dashboard");
}

const tutorialSchema = z.object({
  next: z.string().optional(),
});

export async function completeTutorialAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?next=/onboarding/tutorial");
  }

  const parsed = tutorialSchema.safeParse({
    next: formData.get("next") || undefined,
  });
  const next = parsed.success ? parsed.data.next : undefined;

  await updateRows("User", { id: session.user.id }, { onboardedAt: new Date() });

  redirect(next ?? "/dashboard");
}

/** Skipping the tutorial still flags it complete so we don't re-prompt. */
export async function skipTutorialAction(next?: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  await updateRows("User", { id: session.user.id }, { onboardedAt: new Date() });

  redirect(next ?? "/dashboard");
}
