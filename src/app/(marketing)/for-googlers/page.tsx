/**
 * `/for-googlers` — landing page for Google Cloud field teams.
 *
 * Google sales, partner managers, and customer engineers send
 * customers to AI Partner. This page makes that flow obvious: a
 * shareable referral link, talk-track snippets, and a path to the
 * Googler-specific cockpit (`/googler/dashboard`) once they sign in
 * with their @google.com address.
 *
 * No auth required to read. Sign-in is via Google SSO and is gated
 * on `@google.com` domain — the credential provider enforces this.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Partner for Googlers — accelerate every partner conversation",
  description:
    "Send your customer to AI Partner for a vetted shortlist in minutes. Built for Google Cloud field teams.",
};

const TALKING_POINTS = [
  {
    title: "Hand-off your toughest partner asks",
    body:
      "Whether a customer needs a specialist in retail GenAI or migration in APAC, AI Partner shortlists three best-fit partners — with rationale, certifications, and recent wins.",
  },
  {
    title: "Track every referral",
    body:
      "Your Googler cockpit shows the briefs you've sent in, who picked them up, and outcome (win/loss). No more chasing partner managers for status.",
  },
  {
    title: "Stay neutral by design",
    body:
      "Scoring is transparent. We don't bias toward any partner; certifications and customer success metrics drive the ranking, not deal margin.",
  },
];

const FAQ = [
  {
    q: "Is AI Partner endorsed by Google?",
    a: "We're built on the public Google Cloud partner registry and align with the Partner Advantage program, but we're independent. Use AI Partner the way you'd use any vetted third-party tool.",
  },
  {
    q: "How do customers sign up?",
    a: "Send them to /briefs/new (or share your referral link from the cockpit). They self-serve onboarding; you get a notification when they finish the brief.",
  },
  {
    q: "What data do you share with the partner?",
    a: "An anonymised company profile and the brief itself. Customer identity is revealed only after they accept a match and the partner signs T&Cs.",
  },
];

export default function ForGooglersPage() {
  return (
    <div className="mesh-bg min-h-screen">
      <div className="container mx-auto max-w-5xl px-6 py-20 md:py-28 space-y-20">
        <header className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-700 ring-1 ring-inset ring-blue-600/10">
            Built for Google Cloud field teams
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-950 leading-[0.95]">
            Send your customer.{" "}
            <span className="gradient-text italic font-serif">
              We&rsquo;ll find the partner.
            </span>
          </h1>
          <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-2xl">
            AI Partner gives your customers a vetted partner shortlist in
            minutes. You stay neutral, your AE keeps the trust, and the deal
            moves faster.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/auth/signin?callbackUrl=%2Fgoogler%2Fdashboard"
              className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800"
            >
              Sign in with @google.com →
            </Link>
            <Link
              href="/sandbox"
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Try the sandbox
            </Link>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {TALKING_POINTS.map((t) => (
            <div
              key={t.title}
              className="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t.body}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-xl shadow-slate-900/5">
          <h2 className="text-2xl font-bold text-slate-900">
            Talk-track you can paste
          </h2>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-950 p-6 text-sm leading-relaxed text-slate-100">
{`Hey {customer},

For the partner search we discussed, I'd recommend AI Partner —
it's the fastest way to get a vetted shortlist with rationale.
Spin up a brief here: https://app.aipartner.example/briefs/new

Once you submit, three best-fit partners land in your inbox.
Let me know who you pick and I'll loop in for the kickoff.

— {your name}`}
          </pre>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">FAQ</h2>
          <dl className="space-y-4">
            {FAQ.map((f) => (
              <div
                key={f.q}
                className="rounded-3xl border border-slate-200 bg-white p-6"
              >
                <dt className="font-semibold text-slate-900">{f.q}</dt>
                <dd className="mt-1 text-sm text-slate-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
