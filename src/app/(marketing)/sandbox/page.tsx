/**
 * `/sandbox` — public, no-auth demo entry point.
 *
 * The page sells the experience and exposes a single CTA that POSTs
 * `/api/sandbox/seed`. On success, the server route sets a sandbox
 * cookie and the client redirects to the demo brief detail view.
 *
 * We keep the demo deliberately self-contained: no signup, no
 * onboarding survey. The visitor lands on a populated brief and can
 * tour the same UI customers use.
 */

import type { Metadata } from "next";
import { SandboxLauncher } from "./_components/sandbox-launcher";

export const metadata: Metadata = {
  title: "Try AI Partner — interactive sandbox",
  description:
    "Tour the full AI Partner experience with a one-click demo session. No signup, expires in 60 minutes.",
};

const FEATURES = [
  {
    title: "Pre-filled project brief",
    body: "BigQuery migration with budget, scope, and success criteria already captured.",
  },
  {
    title: "Risk Radar report",
    body: "AI-generated risks and mitigations attached to the brief.",
  },
  {
    title: "Match shortlist",
    body: "Three synthetic partners ranked by fit with explainable rationale.",
  },
  {
    title: "Proposal comparison",
    body: "Side-by-side proposals you can pin/un-pin to test the winner flow.",
  },
];

export default function SandboxPage() {
  return (
    <div className="mesh-bg min-h-screen">
      <div className="container max-w-4xl mx-auto py-24 md:py-32 space-y-16">
        <header className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
            Interactive Sandbox · Live data
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-950 leading-[0.95]">
            Tour the product.{" "}
            <span className="gradient-text italic font-serif">No signup.</span>
          </h1>
          <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
            One click drops you into a pre-populated brief — a real
            mid-market analytics migration — so you can poke at every
            screen our customers use.
          </p>
        </header>

        <SandboxLauncher />

        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-xl shadow-slate-900/5">
          <h2 className="text-2xl font-bold text-slate-900">
            What&rsquo;s in the sandbox
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
              >
                <p className="font-semibold text-slate-900">{f.title}</p>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-slate-500">
            Sandbox sessions expire after 60 minutes. All synthetic data
            is purged automatically; nothing the demo creates touches a
            real customer or partner tenant.
          </p>
        </div>
      </div>
    </div>
  );
}
