"use client";

/**
 * Guided first-run intake.
 *
 * Ordering is deliberate and is the single most important UX decision here:
 * **import first, questions second.** A partner who watches 60% of their
 * profile populate from a URL will finish the remaining 40%. A partner who
 * hits a blank 19-field form will not. The plan's 3–5 minute target depends
 * entirely on this ordering.
 *
 * Every step saves independently and records `onboardingStep`, so closing the
 * tab loses nothing. Steps are skippable — only the registry's `required`
 * fields gate completion, and the wizard says exactly which those are.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fieldsForPillar, pillarsInOrder } from "@/lib/partner-pillars";
import type { PillarValues } from "@/lib/partner-pillar-values";
import { computeProfileStrength } from "@/lib/partner-strength";
import { PillarField } from "@/components/partner/inputs/pillar-field";
import {
  completeOnboardingAction,
  savePillarStepAction,
  setOnboardingStepAction,
} from "@/lib/actions/partner-pillars";
import {
  ImportStep,
  type ImportedPillarPatch,
} from "@/components/partner/onboarding-import-step";

export function OnboardingWizard({
  initialValues,
  initialTagLabels,
  companyName,
  initialStep,
  directoryUrl,
  website,
}: {
  initialValues: PillarValues;
  initialTagLabels: Record<string, string>;
  companyName: string;
  initialStep: string | null;
  directoryUrl: string;
  website: string;
}) {
  const router = useRouter();
  const pillars = useMemo(() => pillarsInOrder(), []);

  // Step 0 is import; 1..N are pillars; N+1 is review.
  const stepKeys = useMemo(
    () => ["import", ...pillars.map((p) => p.key), "review"],
    [pillars],
  );
  const resumeIndex = Math.max(
    0,
    initialStep ? stepKeys.indexOf(initialStep) : 0,
  );

  const [stepIndex, setStepIndex] = useState(
    resumeIndex === -1 ? 0 : resumeIndex,
  );
  const [values, setValues] = useState<PillarValues>(initialValues);
  const [tagLabels, setTagLabels] =
    useState<Record<string, string>>(initialTagLabels);
  const [provenance, setProvenance] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const strength = useMemo(() => computeProfileStrength(values), [values]);
  const currentKey = stepKeys[stepIndex];
  const isImport = currentKey === "import";
  const isReview = currentKey === "review";
  const currentPillar = pillars.find((p) => p.key === currentKey);

  const setField = (key: string, next: unknown) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    // Once the partner edits an imported field it is theirs, so drop the
    // provenance chip rather than continuing to claim it came from a source.
    setProvenance((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyImport = (patch: ImportedPillarPatch) => {
    setValues((prev) => ({ ...prev, ...patch.values }));
    setTagLabels((prev) => ({ ...prev, ...patch.tagLabels }));
    setProvenance((prev) => ({ ...prev, ...patch.provenance }));
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    // Fire-and-forget: resume position is a convenience, so a failure here
    // must never block navigation or surface an error to the partner.
    void setOnboardingStepAction({ step: stepKeys[index] }).catch(() => {});
  };

  const saveCurrentPillar = async (): Promise<boolean> => {
    if (!currentPillar) return true;
    const fieldKeys = fieldsForPillar(currentPillar.key).map((f) => f.key);
    const scoped: PillarValues = {};
    for (const key of fieldKeys) scoped[key] = values[key];

    const result = await savePillarStepAction({
      pillar: currentPillar.key,
      values: scoped,
    });
    if (!result.ok) {
      toast.error(
        result.error.code === "INVALID_INPUT"
          ? (result.error.issues[0]?.message ?? "Some answers need attention")
          : "Could not save this step",
      );
      return false;
    }
    return true;
  };

  const next = () => {
    startTransition(async () => {
      if (currentPillar && !(await saveCurrentPillar())) return;
      goTo(Math.min(stepIndex + 1, stepKeys.length - 1));
    });
  };

  const back = () => goTo(Math.max(stepIndex - 1, 0));

  const finish = () => {
    startTransition(async () => {
      const result = await completeOnboardingAction({});
      if (result.ok) {
        toast.success("Your profile is live");
        router.push("/partner");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.message ?? "A few required answers are missing")
            : "Could not finish setup",
        );
      }
    });
  };

  const skipAll = () => {
    startTransition(async () => {
      // Stamping a step is what releases the portal's first-run gate. Without
      // it the partner lands on /partner and is redirected straight back here,
      // making "Finish later" a loop. No completion stamp is written, so the
      // banner keeps nudging until the required fields are answered.
      await setOnboardingStepAction({ step: stepKeys[stepIndex] });
      router.push("/partner");
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 py-8 sm:py-12">
      {/*
       * This route is deliberately outside the `(portal)` group, and the only
       * other Toaster lives in `PortalShellClient` — so without this every
       * toast raised here was dropped. A step that fails validation would
       * then refuse to advance while saying nothing, which is indistinguishable
       * from a broken Continue button. Config mirrors the portal's.
       */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            "!rounded-[14px] !border !border-border !bg-card !text-foreground !shadow-[var(--elev-2)] !font-ui",
        }}
      />

      <header className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          Set up {companyName}
        </span>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[30px]">
          {isImport
            ? "Let's fill this in for you"
            : isReview
              ? "You're ready to go live"
              : (currentPillar?.label ?? "")}
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          {isImport
            ? "Paste a link and we'll pull what's public. You can edit everything before anything is saved."
            : isReview
              ? "Here's what clients will use to match you. You can change any of it later."
              : (currentPillar?.hint ?? "")}
        </p>
      </header>

      <StepRail
        steps={stepKeys.map((key, i) => ({
          key,
          label:
            key === "import"
              ? "Import"
              : key === "review"
                ? "Review"
                : (pillars.find((p) => p.key === key)?.label ?? key),
          done: i < stepIndex,
          current: i === stepIndex,
        }))}
        onSelect={goTo}
      />

      {isImport && (
        <ImportStep
          directoryUrl={directoryUrl}
          website={website}
          onApply={applyImport}
          onSkip={() => goTo(1)}
        />
      )}

      {currentPillar && (
        <Card className="border-line bg-card shadow-elev-1">
          <CardContent className="space-y-9 p-5 sm:p-7">
            {fieldsForPillar(currentPillar.key).map((field) => (
              <div key={field.key} className="space-y-2">
                {provenance[field.key] && (
                  <ProvenanceChip source={provenance[field.key]} />
                )}
                <PillarField
                  field={field}
                  value={values[field.key]}
                  onChange={(nextValue) => setField(field.key, nextValue)}
                  tagLabels={tagLabels}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isReview && (
        <ReviewPanel strength={strength} />
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button
              variant="ghost"
              onClick={back}
              disabled={pending}
              className="h-11"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={skipAll}
            disabled={pending}
            className="h-11 text-muted-foreground"
          >
            Finish later
          </Button>
        </div>

        {isReview ? (
          <Button
            onClick={finish}
            disabled={pending || !strength.readyToComplete}
            className="h-11 px-7 font-semibold"
          >
            <PartyPopper className="h-4 w-4" />
            {pending ? "Publishing…" : "Publish my profile"}
          </Button>
        ) : (
          <Button
            onClick={next}
            disabled={pending}
            className="h-11 px-7 font-semibold"
          >
            {pending ? "Saving…" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StepRail({
  steps,
  onSelect,
}: {
  steps: { key: string; label: string; done: boolean; current: boolean }[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((step, i) => (
        <button
          key={step.key}
          type="button"
          onClick={() => onSelect(i)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
            step.current
              ? "border-primary bg-primary-soft text-primary"
              : step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-line bg-card text-muted-foreground hover:border-line-strong",
          )}
        >
          {step.done && <Check className="h-3 w-3" />}
          {step.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Marks a value that arrived from a public source.
 *
 * This exists because "how did it find all this information?" was the first
 * reaction to the importer. Naming the source turns that surprise into trust,
 * and makes it obvious the partner is expected to check it.
 */
function ProvenanceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10.5px] font-medium text-primary">
      <Sparkles className="h-3 w-3" />
      {source === "directory"
        ? "From your Google Cloud listing — please check"
        : "From your website — please check"}
    </span>
  );
}

function ReviewPanel({
  strength,
}: {
  strength: ReturnType<typeof computeProfileStrength>;
}) {
  return (
    <div className="space-y-5">
      <Card className="border-line bg-surface-sunk shadow-none">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">
              Profile strength
            </span>
            <span className="text-[15px] font-semibold tabular-nums text-primary">
              {strength.score}%
            </span>
          </div>
          <Progress value={strength.score} className="h-1.5" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {strength.nextBestAction ??
              "Everything is filled in. Strong profiles get shortlisted more often."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {strength.perPillar.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3"
          >
            <span className="text-[12.5px] font-medium text-foreground">
              {p.label}
            </span>
            {p.complete ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                {p.percent}%
              </span>
            )}
          </div>
        ))}
      </div>

      {!strength.readyToComplete && (
        <Card className="border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="p-4">
            <p className="text-[12.5px] font-medium text-amber-950">
              Before publishing, please answer:
            </p>
            <ul className="mt-2 space-y-1">
              {strength.missingRequired.map((m) => (
                <li key={m.key} className="text-[12px] text-amber-800">
                  {m.pillarLabel} — {m.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
