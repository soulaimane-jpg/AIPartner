/**
 * `/trust` — security + privacy posture, sub-processor registry,
 * compliance statements.
 *
 * This page is a single source of truth for procurement reviews.
 * Anything we'd otherwise paste into a security questionnaire lives
 * here so prospects (and bots scraping the page) can self-serve.
 *
 * Sub-processor list is read from the DB so an admin update
 * propagates in ≤ 60s without a deploy.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { groupSubProcessorsByRegion } from "@/lib/sub-processors";
import { POLICY_VERSION } from "@/lib/cookie-consent";

export const metadata: Metadata = {
  title: "Trust & security — AI Partner",
  description:
    "How AI Partner protects customer and partner data, plus our sub-processor list, compliance posture, and cookie policy.",
};

const COMPLIANCE = [
  {
    title: "Data residency",
    body:
      "Production data is stored in EU (Frankfurt) for EU tenants and US (Iowa) for US tenants. Region is set at company creation; we never replicate across boundaries without explicit consent.",
  },
  {
    title: "Encryption in transit",
    body:
      "TLS 1.3 everywhere. HSTS preload enforced on the apex domain. Webhook deliveries reject HTTP and any redirect.",
  },
  {
    title: "Encryption at rest",
    body:
      "Database volumes are encrypted with AES-256 (provider-managed keys). Application-level AES-256-GCM wraps secrets we have to store but never re-display (TOTP, SCIM, webhook secrets).",
  },
  {
    title: "Audit trail",
    body:
      "Every state-changing action emits an immutable audit row with the actor, payload (redacted), IP hash, and trace id. Logs are retained for 365 days; tenants can export their slice via the public API.",
  },
  {
    title: "Access control",
    body:
      "Workforce SSO via Google Workspace, MFA mandatory. Application RBAC enforced per-action with row-level conditions; least-privilege defaults for every role.",
  },
  {
    title: "Vendor management",
    body:
      "Every sub-processor is contractually bound to GDPR Art. 28 obligations. New additions require a DPA addendum and 30-day notice.",
  },
];

export default async function TrustPage() {
  const subProcessorsByRegion = await groupSubProcessorsByRegion();
  const regions = Object.keys(subProcessorsByRegion).sort();

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-6 py-16 md:py-24 space-y-16">
        <header className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Trust centre
          </p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-950">
            Security and privacy at AI Partner.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            We build for procurement teams. This page is the public
            mirror of our internal security playbook — refreshed in lockstep with the product.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c.title}
              className="rounded-3xl border border-slate-200 bg-white p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {c.body}
              </p>
            </div>
          ))}
        </section>

        <section id="sub-processors" className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Sub-processors
            </h2>
            <p className="max-w-3xl text-slate-600">
              Vendors that process customer data on our behalf. Machine-readable
              JSON is available at{" "}
              <Link
                href="/api/v1/sub-processors"
                className="font-mono text-sm underline"
              >
                /api/v1/sub-processors
              </Link>
              .
            </p>
          </div>
          {regions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              The registry is currently empty. The admin team is preparing the
              first batch — check back shortly.
            </div>
          ) : (
            regions.map((region) => (
              <div
                key={region}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                    {region}
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-2 font-medium">Vendor</th>
                      <th className="px-6 py-2 font-medium">Purpose</th>
                      <th className="px-6 py-2 font-medium">Certifications</th>
                      <th className="px-6 py-2 font-medium">Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subProcessorsByRegion[region].map((sp) => (
                      <tr key={sp.id} className="border-t border-slate-100">
                        <td className="px-6 py-3 font-medium text-slate-900">
                          {sp.url ? (
                            <a
                              href={sp.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="hover:underline"
                            >
                              {sp.name}
                            </a>
                          ) : (
                            sp.name
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{sp.purpose}</td>
                        <td className="px-6 py-3 text-slate-600">
                          {sp.certifications.length > 0
                            ? sp.certifications.join(", ")
                            : "—"}
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          {sp.effectiveFrom.toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>

        <section id="cookies" className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">
            Cookie policy
          </h2>
          <p className="text-slate-600">
            We use three categories of cookies:
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <strong className="text-slate-900">Necessary</strong> — required
              for authentication, CSRF protection, language preference. Always
              on; can&rsquo;t be disabled without breaking the product.
            </li>
            <li>
              <strong className="text-slate-900">Analytics</strong> — anonymous
              product usage telemetry (PostHog). Off by default; opt-in via the
              banner.
            </li>
            <li>
              <strong className="text-slate-900">Marketing</strong> — retargeting
              pixels. Off by default; opt-in via the banner.
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            Policy version <span className="font-mono">{POLICY_VERSION}</span>.
            You can change your choice anytime via the banner; clearing the
            cookie re-prompts you.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <h2 className="text-2xl font-bold text-slate-900">
            Security disclosures
          </h2>
          <p className="mt-2 text-slate-600">
            Found a vulnerability? Email{" "}
            <a
              className="font-mono text-sm underline"
              href="mailto:security@aipartner.example"
            >
              security@aipartner.example
            </a>{" "}
            with a clear description, reproduction steps, and your contact
            details. We respond within one business day and credit reporters
            in our hall of fame on request.
          </p>
        </section>
      </div>
    </div>
  );
}
