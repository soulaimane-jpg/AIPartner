/**
 * `/partners/[id]` — public partner profile.
 *
 * Read-only marketing surface. We render only the fields surfaced by
 * `findPublicPartner` (the redacted view); seat counts, lead routing
 * emails, and other sensitive bits never leave the server.
 *
 * CTA hierarchy:
 *   - Primary: "Start a brief" → /briefs/new
 *   - Secondary: external partner website (when present)
 *
 * We never expose direct contact info — routing through a brief keeps
 * the matching loop intact and prevents end-runs around our vetting.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { findPublicPartner } from "@/lib/public-directory";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const partner = await findPublicPartner(id);
  if (!partner) return { title: "Partner not found — AI Partner" };
  return {
    title: `${partner.name} — AI Partner directory`,
    description:
      partner.tagline ??
      `${partner.name} is a Google Cloud partner specializing in ${partner.specializations.slice(0, 3).join(", ")}.`,
  };
}

export default async function PartnerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const partner = await findPublicPartner(id);
  if (!partner) notFound();

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-6 py-16 md:py-24 space-y-10">
        <Link
          href="/partners"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to directory
        </Link>

        <header className="grid gap-8 md:grid-cols-[auto,1fr] items-start">
          <div className="size-24 rounded-2xl bg-white ring-1 ring-slate-200 flex items-center justify-center text-3xl font-bold text-slate-700">
            {partner.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={partner.logoUrl}
                alt=""
                className="size-full rounded-2xl object-cover"
              />
            ) : (
              partner.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {partner.tier} partner · {partner.headquarters ?? "Global"}
            </p>
            <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-slate-950">
              {partner.name}
            </h1>
            {partner.tagline && (
              <p className="mt-3 text-lg text-slate-600">{partner.tagline}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/briefs/new"
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Start a brief
              </Link>
              {partner.website && (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Visit website ↗
                </a>
              )}
            </div>
          </div>
        </header>

        {partner.description && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
              About
            </h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-700">
              {partner.description}
            </p>
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2">
          <ProfileSection title="Specializations" items={partner.specializations} />
          <ProfileSection title="Industries" items={partner.industryExperience} />
          <ProfileSection title="Regions" items={partner.regions} />
          <ProfileSection title="Languages" items={partner.languages} />
          <ProfileSection title="Service models" items={partner.serviceModels} />
          <ProfileSection
            title="Certifications"
            items={partner.certifications.map((c) =>
              c.level ? `${c.name} · ${c.level}` : c.name,
            )}
          />
        </section>
      </div>
    </div>
  );
}

function ProfileSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
