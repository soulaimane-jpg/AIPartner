"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Users,
  LifeBuoy,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  completeTutorialAction,
  skipTutorialAction,
} from "@/lib/actions/onboarding";

const STEPS = [
  {
    icon: Sparkles,
    title: "How AI Partner works",
    body:
      "AI Partner turns your business and cloud context into a structured brief, supports controlled sourcing, and keeps partner evaluation in one workspace.",
    bullets: [
      "Input → capture the business outcome and delivery constraints",
      "Sourcing → identify suitable Google Cloud partners",
      "Connection → compare proposals and choose who to meet",
    ],
  },
  {
    icon: FileText,
    title: "What a great brief looks like",
    body:
      "A useful brief is specific about the target outcome, current environment, and non-negotiable constraints. This cost-optimization example shows the level of detail partners need.",
    bullets: [
      'Goal: "Reduce data-platform ops cost by 35% in 9 months"',
      'Constraints: "Must keep ISO 27001 + EU residency"',
      'Tech: "Current stack: BigQuery, Looker, Cloud Composer"',
    ],
    sample: true,
  },
  {
    icon: Users,
    title: "Bring your team along",
    body:
      "Owners and Admins manage the company workspace. Brief creators separately decide who can open and act on each brief.",
    bullets: [
      "Workspace Owner / Admin — manages members and company context",
      "Editor / Reviewer / Viewer — controls work and visibility per brief",
      "Approver — must approve before sourcing starts",
    ],
  },
  {
    icon: LifeBuoy,
    title: "Need help?",
    body:
      "Support options appear in your workspace only when they are operational. You can continue editing your brief at any time.",
    bullets: [
      "Use the guided builder for brief questions",
      "Workspace support contact is shown when available",
      "No response or matching time is promised before confirmation",
    ],
  },
];

export function TutorialOverlay({ next }: { next?: string }) {
  const [idx, setIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const step = STEPS[idx];
  const Icon = step.icon;
  const isLast = idx === STEPS.length - 1;

  function handleSkip() {
    startTransition(async () => {
      await skipTutorialAction(next);
    });
  }

  function handleFinish() {
    startTransition(async () => {
      const fd = new FormData();
      if (next) fd.set("next", next);
      await completeTutorialAction(undefined, fd);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cinema-bg/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-line shadow-elev-3 overflow-hidden">
        {/* Progress */}
        <div className="flex items-center gap-1.5 px-6 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-240 ${
                i <= idx ? "bg-brand-1" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="p-8 pt-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-1/10 text-brand-1 shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
                Step {idx + 1} of {STEPS.length}
              </p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h2>
            </div>
          </div>

          <p className="text-[14px] leading-[1.6] text-muted-foreground">
            {step.body}
          </p>

          <ul className="space-y-2 rounded-xl bg-surface-1 p-4 border border-line">
            {step.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-[13px] text-foreground"
              >
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {step.sample && (
            <div className="rounded-xl bg-cinema-bg text-white p-4 text-[12.5px] leading-[1.6] font-mono">
              <div className="text-amber-300/90 mb-1">Executive summary</div>
              We migrate our analytics workloads from on-prem Vertica to BigQuery
              to halve query latency for our 200-strong commercial team. We need
              a partner certified in GCP Data Analytics with healthcare
              experience (HIPAA-equivalent controls). Go-live: 31 Mar 2026.
              Budget: €280–360k over 6 months.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-surface-1 border-t border-line">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={pending}
          >
            Skip tutorial
          </Button>
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={pending}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button
                type="button"
                onClick={handleFinish}
                disabled={pending}
                size="sm"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                Enter workspace
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                disabled={pending}
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
