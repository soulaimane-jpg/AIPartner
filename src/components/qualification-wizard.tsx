"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Cloud, CheckCircle2, Blocks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SERVICE_CATEGORIES_LABEL } from "@/lib/constants";
import type { Procurement, ServiceCategory } from "@/lib/enums";
import { createBriefAction } from "@/lib/actions/briefs";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";

const PROCUREMENT_HELP: Record<Procurement, string> = {
  DIRECT_GOOGLE:
    "You contract directly with Google Cloud — Google invoices you, no intermediary. Best when you have internal procurement capacity and want list pricing.",
  VIA_RESELLER:
    "A certified Google Cloud reseller handles billing and often bundles volume discounts, consolidated invoicing, and support. Common for mid-market buyers.",
  UNSURE:
    "That's fine — we'll recommend a path based on your profile and the partners we match you with.",
};

const SERVICE_HELP: Record<ServiceCategory, string> = {
  RESELLING:
    "Choose this if you want a partner to handle the commercial relationship with Google Cloud — invoicing, volume credits, cost reviews, and account management.",
  CONSULTING:
    "Choose this if you need hands-on delivery: solution architecture, building or migrating workloads, data/AI platforms, or security implementation.",
  MANAGED:
    "Choose this if you want a partner to run your cloud day-to-day after launch — 24/7 monitoring, patching, incident response, with an SLA.",
  SUPPORT:
    "Choose this if you only need reactive technical help: ticket-based assistance, L1–L3 escalation, and break-fix coverage.",
  TRAINING:
    "Choose this if you want to upskill your team — GCP bootcamps, hands-on labs, and certification prep.",
};

const PROCUREMENT_OPTIONS: { value: Procurement; label: string }[] = [
  { value: "DIRECT_GOOGLE", label: "Direct from Google" },
  { value: "VIA_RESELLER", label: "Via Reseller / Partner" },
  { value: "UNSURE", label: "I’m not sure yet" },
];

const SERVICE_DETAILS: Record<
  ServiceCategory,
  { title: string; detail: string; included: string }
> = {
  RESELLING: {
    title: "Reselling (Financial)",
    detail: "Billing, licensing, and financial services",
    included: "Invoicing, cost optimization, credits, account management.",
  },
  CONSULTING: {
    title: "Consulting (Project-Based)",
    detail: "Migration, App Modernization, Data/AI, Security",
    included: "Architecture, build, migration, and handover.",
  },
  MANAGED: {
    title: "Managed Services (Ongoing)",
    detail: "Continuous monitoring and operations",
    included: "24/7 monitoring, patching, incident response, SLA.",
  },
  SUPPORT: {
    title: "Support (Reactive)",
    detail: "Technical support services",
    included: "Ticket-based response, escalation, L1–L3 triage.",
  },
  TRAINING: {
    title: "Training & Enablement",
    detail: "Workshops and certification prep",
    included: "Bootcamps, hands-on labs, certification paths.",
  },
};

type StepKey = "qualify" | "cloud" | "services";

export function QualificationWizard() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [usesCloud, setUsesCloud] = useState(false);
  const [hadPartner, setHadPartner] = useState(false);
  const [procurement, setProcurement] = useState<Procurement | "">("");
  const [services, setServices] = useState<Set<ServiceCategory>>(new Set());
  const [pending, startTransition] = useTransition();

  const steps: { key: StepKey; label: string }[] = [
    { key: "qualify", label: "Qualification" },
    { key: "cloud", label: "Cloud Context" },
    { key: "services", label: "Expertise" },
  ];

  const toggle = (k: ServiceCategory) => {
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const canContinue =
    step === 0 ? !!procurement : step === 1 ? true : services.size > 0;

  const onComplete = () => {
    if (!canContinue) return;
    startTransition(async () => {
      const result = await createBriefAction({
        usesCloud,
        hadPartner,
        procurement: (procurement || "UNSURE") as Procurement,
        services: Array.from(services),
      });
      if (!result.ok) {
        const msg =
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Please check the form.")
            : result.error.code === "RATE_LIMITED"
              ? "Too many briefs created — try again in a moment."
              : result.error.code === "FORBIDDEN"
                ? "You don't have permission to start a brief."
                : "Could not start discovery.";
        toast.error(msg);
        return;
      }
      // Server didn't redirect; navigate from the client.
      window.location.assign(`/briefs/${result.data.briefId}/builder`);
    });
  };

  return (
    <Card className="overflow-hidden border-border bg-card shadow-elev-2">
      <CardContent className="space-y-7 p-0">
        {/* Step indicator */}
        <div className="border-b border-border bg-surface-sunk px-5 py-4 sm:px-7" aria-live="polite">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-muted-foreground">
              Step {step + 1} of {steps.length}
              <span className="font-medium text-foreground"> · {steps[step].label}</span>
            </div>
            <span className="text-[11px] font-medium tabular-nums text-blue-700">
              {Math.round(((step + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
            {steps.map((item, index) => (
              <div key={item.key} className="flex items-center gap-2">
                <span className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                  index < step && "bg-success text-white",
                  index === step && "bg-blue-600 text-white shadow-elev-1",
                  index > step && "bg-card text-muted-foreground ring-1 ring-border",
                )}>
                  {index < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn("hidden text-[11.5px] sm:block", index === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 px-5 sm:px-7">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <h2 className="text-[14px] font-semibold text-blue-950">Your cloud context</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-blue-800">These answers help us tailor the scoping conversation and partner recommendations.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-6 py-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[14px] font-medium text-foreground cursor-pointer">
                    Already using a cloud provider
                  </Label>
                  <HelpTip>
                    Toggle on if you&apos;re already running workloads in AWS,
                    Azure, Google Cloud, or another public cloud. Helps us
                    match partners experienced with your starting point.
                  </HelpTip>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  AWS, Azure, GCP, or another public cloud.
                </p>
              </div>
              <Switch aria-label="Already using a cloud provider" checked={usesCloud} onCheckedChange={setUsesCloud} />
            </div>

            <div className="border-t border-border" />

            <div className="flex items-center justify-between gap-6 py-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[14px] font-medium text-foreground cursor-pointer">
                    Worked with a cloud partner before
                  </Label>
                  <HelpTip>
                    Toggle on if you&apos;ve worked with a Google Cloud partner
                    or any cloud consultancy before.
                  </HelpTip>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  Past engagements with a consultancy or reseller.
                </p>
              </div>
              <Switch aria-label="Worked with a cloud partner before" checked={hadPartner} onCheckedChange={setHadPartner} />
            </div>

            <div className="border-t border-border" />

            <div className="space-y-2 py-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-[14px] font-medium text-foreground">
                  How you buy cloud services
                </Label>
                <HelpTip>
                  Direct with Google means contracting straight with Google
                  Cloud; via a reseller means a partner handles billing.
                </HelpTip>
              </div>
              <Select
                value={procurement || undefined}
                onValueChange={(v) => setProcurement(v as Procurement)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {PROCUREMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {procurement && (
                <p className="text-[12.5px] text-muted-foreground leading-relaxed pt-1">
                  {PROCUREMENT_HELP[procurement]}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-8 text-center sm:px-8">
            <h3 className="text-[16px] font-medium text-foreground">
              Context captured
            </h3>
            <p className="text-[13.5px] text-muted-foreground max-w-sm mx-auto leading-relaxed px-6">
              We&apos;ll use these answers to guide the AI builder and surface partners with the right commercial model and specialisation.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <Blocks className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <h2 className="text-[14px] font-semibold text-blue-950">What expertise do you need?</h2>
                <p className="mt-0.5 text-[12.5px] text-blue-800">Choose one or more services. You can refine the scope with the AI builder next.</p>
              </div>
            </div>
            <div className="space-y-2">
              {(Object.keys(SERVICE_DETAILS) as ServiceCategory[]).map((k) => {
                const s = SERVICE_DETAILS[k];
                const checked = services.has(k);
                return (
                  <label
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-[border-color,box-shadow,background-color]",
                      checked
                        ? "border-blue-400 bg-blue-50 shadow-elev-1 ring-1 ring-blue-200"
                        : "border-border bg-card hover:border-blue-300 hover:shadow-elev-1",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(k)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-medium text-foreground">
                            {s.title}
                          </span>
                          <HelpTip>{SERVICE_HELP[k]}</HelpTip>
                        </div>
                        <Badge variant="outline" className="text-[10.5px]">
                          {SERVICE_CATEGORIES_LABEL[k]}
                        </Badge>
                      </div>
                      <p className="text-[12.5px] text-muted-foreground">
                        {s.detail}
                      </p>
                      <p className="text-[12px] text-muted-foreground/80">
                        Includes: {s.included}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-sunk px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          )}

          <Button
            size="md"
            disabled={!canContinue || pending}
            aria-busy={pending || undefined}
            className="w-full sm:w-auto"
            onClick={
              step < 2
                ? () => setStep((s) => (s + 1) as 0 | 1 | 2)
                : onComplete
            }
          >
            {pending ? "Creating…" : step < 2 ? "Continue" : "Create brief"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
