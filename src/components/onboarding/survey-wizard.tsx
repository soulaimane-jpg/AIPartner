"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Stepper, Eyebrow } from "@/components/ui/editorial";
import {
  completeSurveyAction,
  type OnboardingState,
} from "@/lib/actions/onboarding";
import { Input } from "@/components/ui/input";
import { CHALLENGE_AREAS } from "@/lib/challenge-areas";
import { inviteWorkspaceMembersAction, type WorkspaceInviteState } from "@/lib/actions/workspace-invites";

type Step = "survey" | "collaborators";

export function SurveyWizard({
  initialName,
  initialJobTitle,
  initialFocusArea,
  initialEmail,
  needsCompany = false,
  lockName = false,
  lockRole = false,
  next,
  initialStep = "survey",
}: {
  initialName: string;
  initialJobTitle: string;
  initialFocusArea: string;
  initialEmail: string;
  /** True when the signed-in CUSTOMER has no `companyId` yet (e.g. Google OAuth sign-up). */
  needsCompany?: boolean;
  /** True when the user's name was already captured at sign-up (credentials flow) — don't re-ask. */
  lockName?: boolean;
  /** True when the user's role/jobTitle was already captured at sign-up — don't re-ask. */
  lockRole?: boolean;
  next?: string;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);

  // Derive first/last from the full name captured at sign-up so we can
  // submit them without re-asking.
  const nameParts = initialName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  const [state, formAction] = useActionState<OnboardingState, FormData>(
    completeSurveyAction,
    undefined,
  );
  const [inviteState, inviteAction] = useActionState<WorkspaceInviteState, FormData>(
    inviteWorkspaceMembersAction,
    undefined,
  );
  const [inviteRows, setInviteRows] = useState([0]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-8">
        <Stepper
          current={step === "survey" ? 0 : 1}
          steps={[
            { label: "About you" },
            { label: "Colleagues" },
          ]}
        />
      </div>

      {step === "survey" ? (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="next" value="/onboarding/survey?step=collaborators" />

          <div className="space-y-2">
            <Eyebrow>Welcome</Eyebrow>
            <h1 className="font-display text-[30px] leading-[1.1] font-medium text-foreground tracking-[-0.022em] text-balance">
              Tell us a little about you.
            </h1>
            <p className="text-[13.5px] text-muted-foreground leading-[1.6]">
              Thirty seconds of context so we can match your briefs to the
              right partners faster.
            </p>
          </div>

          {(lockName || lockRole) && (
            <p className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
              Continuing as{" "}
              <span className="font-medium text-foreground">
                {[firstName, lastName].filter(Boolean).join(" ") || initialEmail}
              </span>
              {lockRole && initialJobTitle ? <> · {initialJobTitle}</> : null}
              .{" "}
              <Link href="/account" className="text-primary hover:underline">
                Edit
              </Link>
            </p>
          )}

          {lockName ? (
            <>
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="lastName" value={lastName} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name" htmlFor="firstName" required>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={firstName}
                  autoComplete="given-name"
                  required
                />
              </FormField>
              <FormField label="Last name" htmlFor="lastName" required>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={lastName}
                  autoComplete="family-name"
                  required
                />
              </FormField>
            </div>
          )}

          {needsCompany && (
            <FormField
              label="Company name"
              htmlFor="companyName"
              required
              helper="The organisation you're sourcing partners for."
            >
              <Input
                id="companyName"
                name="companyName"
                autoComplete="organization"
                placeholder="e.g. Optiocean"
                maxLength={120}
                required
              />
            </FormField>
          )}

          {lockRole ? (
            <input type="hidden" name="jobTitle" value={initialJobTitle} />
          ) : (
            <FormField
              label="Your role"
              htmlFor="jobTitle"
              required
              helper="e.g. VP Engineering, CTO, Head of Data"
            >
              <Input
                id="jobTitle"
                name="jobTitle"
                defaultValue={initialJobTitle}
                required
              />
            </FormField>
          )}

          <fieldset className="space-y-3">
            <legend className="text-[13px] font-medium text-foreground">
              What is the main challenge you&apos;re trying to solve with a partner? <span aria-hidden>*</span>
            </legend>
            <p className="text-[12.5px] text-muted-foreground">Pick everything that applies — this shapes who we match you with.</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {CHALLENGE_AREAS.map((area) => (
                <label key={area.key} className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/60">
                  <input
                    type="checkbox"
                    name="challengeAreas"
                    value={area.key}
                    defaultChecked={initialFocusArea.toLowerCase().includes(area.key.replace("_", " "))}
                    className="peer sr-only"
                  />
                  <Check className="absolute right-3 top-3 h-4 w-4 text-blue-700 opacity-0 peer-checked:opacity-100" />
                  <span className="block pr-6 text-[13px] font-semibold text-foreground">{area.title}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">{area.description}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {area.tags.map((tag) => (
                      <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground peer-checked:bg-blue-100 peer-checked:text-blue-800">{tag}</span>
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {state?.error && (
            <p className="text-[12px] text-destructive">{state.error}</p>
          )}

          <input type="hidden" name="email" value={initialEmail} readOnly />

          <div className="flex items-center justify-between pt-2">
            {needsCompany ? (
              <span className="text-[12.5px] text-muted-foreground">
                A company name is required to start a brief.
              </span>
            ) : (
              <Link
                href="?skip=1"
                onClick={(e) => {
                  e.preventDefault();
                  fetch("/api/onboarding/skip-survey", { method: "POST" }).then(
                    () => {
                      window.location.href = next ?? "/dashboard";
                    },
                  );
                }}
                className="text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Do this later
              </Link>
            )}
            <ContinueButton />
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Eyebrow>Step 02</Eyebrow>
            <h1 className="font-display text-[30px] leading-[1.1] font-medium text-foreground tracking-[-0.022em] text-balance">
              Invite your colleagues.
            </h1>
            <p className="text-[13.5px] text-muted-foreground leading-[1.6]">
              Add teammates to your company workspace and choose their role. Access to individual briefs is controlled per brief — you decide who sees what.
            </p>
          </div>

          <form action={inviteAction} className="space-y-3">
            {inviteRows.map((row) => (
              <div key={row} className="grid grid-cols-[minmax(0,1fr)_120px_36px] gap-2">
                <Input name="inviteEmail" type="email" placeholder="colleague@company.com" aria-label="Colleague email" />
                <select name="inviteRole" defaultValue="MEMBER" aria-label="Workspace role" className="h-10 rounded-md border border-input bg-background px-3 text-[13px]">
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                </select>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove invite" disabled={inviteRows.length === 1} onClick={() => setInviteRows((rows) => rows.filter((value) => value !== row))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {inviteState?.error && <p className="text-[12px] text-destructive">{inviteState.error}</p>}
            <Button type="button" variant="ghost" size="sm" onClick={() => setInviteRows((rows) => [...rows, Math.max(...rows) + 1])}>
              <Plus className="h-3.5 w-3.5" /> Add another
            </Button>
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <Button type="button" variant="ghost" size="md" onClick={() => setStep("survey")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="md"><Link href={next ?? "/onboarding/tutorial"}>Skip for now</Link></Button>
                <Button type="submit" size="md"><UserPlus className="h-3.5 w-3.5" /> Send invites &amp; continue</Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="md">
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ArrowRight className="h-3.5 w-3.5" />
      )}
      Continue
    </Button>
  );
}
