"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveOnboardingAnswersAction } from "@/lib/actions/company-onboarding";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface Initial {
  gcpAgreementStatus: string | null;
  gcpContractEndDate: string | null;
  gcpDiscountPct: number | null;
  resellInterest: string | null;
  employeeCountBand: string | null;
}

const AGREEMENT_OPTIONS = [
  { value: "none", label: "No agreement yet" },
  { value: "direct", label: "Yes — direct with Google" },
  { value: "via_partner", label: "Yes — via a partner/reseller" },
  { value: "unknown", label: "I don't know" },
];

const RESELL_OPTIONS = [
  { value: "yes", label: "Yes, interested" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Tell me more" },
];

const EMPLOYEE_BANDS = ["1-50", "51-200", "201-1000", "1001-5000", "5000+"];

/**
 * M2 questions — the exact set from the process diagram. Each field
 * has its own explicit "Skip" toggle; skips are persisted for admin
 * follow-up.
 */
export function CompanyQuestionsForm({
  initial,
  nextHref,
}: {
  initial: Initial;
  nextHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [agreement, setAgreement] = React.useState(
    initial.gcpAgreementStatus && initial.gcpAgreementStatus !== "skipped"
      ? initial.gcpAgreementStatus
      : "",
  );
  const [endDate, setEndDate] = React.useState(initial.gcpContractEndDate ?? "");
  const [discount, setDiscount] = React.useState(
    initial.gcpDiscountPct != null ? String(initial.gcpDiscountPct) : "",
  );
  const [resell, setResell] = React.useState(
    initial.resellInterest && initial.resellInterest !== "skipped"
      ? initial.resellInterest
      : "",
  );
  const [band, setBand] = React.useState(initial.employeeCountBand ?? "");

  const hasAgreement = agreement === "direct" || agreement === "via_partner";

  const submit = (skipAll: boolean) => {
    setError(null);
    startTransition(async () => {
      const skipped: string[] = [];
      if (skipAll || !agreement) skipped.push("gcpAgreementStatus");
      if (skipAll || (hasAgreement && !endDate)) skipped.push("gcpContractEndDate");
      if (skipAll || (hasAgreement && !discount)) skipped.push("gcpDiscountPct");
      if (skipAll || !resell) skipped.push("resellInterest");
      if (skipAll || !band) skipped.push("employeeCountBand");

      const result = await saveOnboardingAnswersAction({
        answers: skipAll
          ? {}
          : {
              gcpAgreementStatus: agreement || null,
              gcpContractEndDate: hasAgreement && endDate ? endDate : null,
              gcpDiscountPct:
                hasAgreement && discount !== "" ? Number(discount) : null,
              resellInterest: resell || null,
              employeeCountBand: band || null,
            },
        skipped: skipped as never,
      });
      if (result.ok) {
        router.replace(nextHref);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background p-6 space-y-6">
      <Field label="Do you have a GCP Enterprise Agreement in place?">
        <div className="grid grid-cols-2 gap-2">
          {AGREEMENT_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={agreement === opt.value}
              onClick={() =>
                setAgreement(agreement === opt.value ? "" : opt.value)
              }
            >
              {opt.label}
            </ChoiceButton>
          ))}
        </div>
      </Field>

      {hasAgreement && (
        <>
          <Field label="When does the contract end?">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="What discount % did you obtain?">
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="e.g. 12"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Only visible to the AIPartner team — never shared with partners.
            </p>
          </Field>
        </>
      )}

      <Field label="Would you be interested in reselling / procuring GCP through a partner?">
        <div className="grid grid-cols-3 gap-2">
          {RESELL_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={resell === opt.value}
              onClick={() => setResell(resell === opt.value ? "" : opt.value)}
            >
              {opt.label}
            </ChoiceButton>
          ))}
        </div>
      </Field>

      <Field label="How many employees does your company have?">
        <div className="flex flex-wrap gap-2">
          {EMPLOYEE_BANDS.map((b) => (
            <ChoiceButton
              key={b}
              active={band === b}
              onClick={() => setBand(band === b ? "" : b)}
            >
              {b}
            </ChoiceButton>
          ))}
        </div>
      </Field>

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={() => submit(true)}
          disabled={pending}
          className="text-muted-foreground"
        >
          Skip for now
        </Button>
        <Button onClick={() => submit(false)} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Save and continue
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-medium text-foreground">{label}</div>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-[13px] text-left transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-secondary/60"
      }`}
    >
      {children}
    </button>
  );
}
