"use server";

/**
 * M2 — company onboarding clarification questions (plan-A §6 M2).
 *
 * Exact question set from the process diagram:
 *   - GCP Enterprise Agreement in place?
 *   - Direct or via partner?
 *   - Contract end date?
 *   - Discount % obtained?
 *   - Interested in reselling?
 *
 * Every question is individually skippable; skips persist in
 * `CustomerProfile.onboardingQuestionsState` so admins can follow up
 * ("if they skip we can ask later why"). Answers are editable later
 * from company settings; every write is audit-logged by defineAction.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { insertRow, updateRows } from "@/lib/db";

const ONBOARDING_QUESTION_KEYS = [
  "gcpAgreementStatus",
  "gcpContractEndDate",
  "gcpDiscountPct",
  "resellInterest",
  "employeeCountBand",
] as const;
export type OnboardingQuestionKey = (typeof ONBOARDING_QUESTION_KEYS)[number];

const AnswerInput = z.object({
  answers: z
    .object({
      gcpAgreementStatus: z
        .enum(["none", "direct", "via_partner", "unknown"])
        .nullish(),
      gcpContractEndDate: z.string().nullish(), // ISO date
      gcpDiscountPct: z.coerce.number().min(0).max(100).nullish(),
      resellInterest: z.enum(["yes", "no", "maybe"]).nullish(),
      employeeCountBand: z
        .enum(["1-50", "51-200", "201-1000", "1001-5000", "5000+"])
        .nullish(),
    })
    .default({}),
  /** Question keys the user explicitly skipped. */
  skipped: z.array(z.enum(ONBOARDING_QUESTION_KEYS)).default([]),
});

export const saveOnboardingAnswersAction = defineAction({
  name: "onboarding.company.save",
  input: AnswerInput,
  output: z.object({ ok: z.literal(true) }),
  permission: "onboarding.update",
  rateLimit: { scope: "onboarding.company.save", limit: 30, windowSec: 60 },
  handler: async ({ answers, skipped }, ctx) => {
    const companyId = ctx.user?.companyId;
    if (!companyId) {
      fail({ code: "FORBIDDEN", reason: "Company membership required" });
    }

    const profile = await insertRow<{ onboardingQuestionsState: string }>(
      "CustomerProfile",
      { companyId: companyId! },
      {
        onConflict: `("companyId") DO UPDATE SET "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    // Merge question-state tracking: answered/skipped + timestamp.
    let state: Record<string, { state: string; at: string }> = {};
    try {
      state = JSON.parse(profile.onboardingQuestionsState) as typeof state;
    } catch {
      state = {};
    }
    const now = new Date().toISOString();

    const data: Record<string, unknown> = {};
    if (answers.gcpAgreementStatus != null) {
      data.gcpAgreementStatus = answers.gcpAgreementStatus;
      state.gcpAgreementStatus = { state: "answered", at: now };
    }
    if (answers.gcpContractEndDate != null && answers.gcpContractEndDate !== "") {
      const parsed = new Date(answers.gcpContractEndDate);
      if (!Number.isNaN(parsed.getTime())) {
        data.gcpContractEndDate = parsed;
        state.gcpContractEndDate = { state: "answered", at: now };
      }
    }
    if (answers.gcpDiscountPct != null) {
      data.gcpDiscountPct = answers.gcpDiscountPct;
      state.gcpDiscountPct = { state: "answered", at: now };
    }
    if (answers.resellInterest != null) {
      data.resellInterest = answers.resellInterest;
      state.resellInterest = { state: "answered", at: now };
    }
    if (answers.employeeCountBand != null) {
      data.employeeCountBand = answers.employeeCountBand;
      state.employeeCountBand = { state: "answered", at: now };
    }

    for (const key of skipped) {
      // A skip never overwrites an existing answer.
      if (state[key]?.state !== "answered") {
        state[key] = { state: "skipped", at: now };
        if (key === "gcpAgreementStatus") data.gcpAgreementStatus = "skipped";
        if (key === "resellInterest") data.resellInterest = "skipped";
      }
    }

    await updateRows(
      "CustomerProfile",
      { companyId: companyId! },
      { ...data, onboardingQuestionsState: JSON.stringify(state) },
    );

    revalidatePath("/profile");
    revalidatePath("/onboarding/company");
    return { ok: true as const };
  },
});
