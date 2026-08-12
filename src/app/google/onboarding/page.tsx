import Link from "next/link";
import {
  Zap,
  ShieldCheck,
  Scale,
  TrendingUp,
  Eye,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Why AI Partner · Google Portal" };

const BENEFITS = [
  {
    icon: Zap,
    title: "Fastest path to a matched partner",
    body:
      "A customer can go from a rough idea to a ranked shortlist of GCP engineering partners in under 48 hours.",
  },
  {
    icon: Scale,
    title: "Best-fit partner, not biggest",
    body:
      "Matches are scored on the brief's industry, scale, region, and technical needs — not on partner sales volume.",
  },
  {
    icon: ShieldCheck,
    title: "Unbiased, vetted network",
    body:
      "Every partner is reviewed by Google Cloud. Customers see capability and past work, not sales pitches.",
  },
  {
    icon: TrendingUp,
    title: "Shortest route to revenue",
    body:
      "Proposals are structured and comparable, so customers decide in days. You see the pipeline move in real time.",
  },
  {
    icon: Eye,
    title: "Full visibility",
    body:
      "From account activation to SoW submission to partner selection — you get a live progress trail for every lead you refer.",
  },
];

export default function GooglerOnboardingPage() {
  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <Zap className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">For Google Sales Reps</div>
            <h1 className="portal-page-title">
              Refer a customer. Keep full visibility.
            </h1>
            <p className="portal-page-description">
              AI Partner turns a customer&apos;s project goals into a clean Statement
              of Work, matches them with vetted GCP engineering partners, and
              keeps you in the loop from first click to signed engagement.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="customer-panel space-y-2 p-5"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              {b.title}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {b.body}
            </div>
          </div>
        ))}
      </div>

      <div className="customer-panel space-y-5 p-5 sm:p-6">
        <div className="text-xs uppercase tracking-wider font-semibold text-primary">
          How it works
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: "1",
              t: "Refer a customer",
              d: "Submit their work email and company domain.",
            },
            {
              n: "2",
              t: "They receive an invite",
              d: "A customized email invites them to AI Partner.",
            },
            {
              n: "3",
              t: "They build a SoW",
              d: "Guided discovery captures scope and goals.",
            },
            {
              n: "4",
              t: "You track progress",
              d: "Every milestone appears on your lead page.",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                {s.n}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {s.t}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {s.d}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/google/leads/new">
            <UserPlus className="h-4 w-4 mr-2" /> Refer your first customer
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/google">
            Go to overview <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
