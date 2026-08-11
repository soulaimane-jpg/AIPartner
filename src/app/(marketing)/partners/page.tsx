/**
 * `/partners` — public partner directory.
 *
 * Server component: filters/search come in as URL params so the page
 * is shareable + crawlable. We render the redacted profile cards
 * straight from `listPublicPartners`.
 *
 * SEO posture: open to indexing. The directory IS one of the product
 * acquisition surfaces — every partner's listing is a backlink they
 * point their own marketing at.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { listPublicPartners } from "@/lib/public-directory";

export const metadata: Metadata = {
  title: "Find your Google Cloud partner — AI Partner directory",
  description:
    "Browse vetted Google Cloud partners. Filter by region, industry, and specialization. Open directory, free to search.",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    region?: string;
    industry?: string;
    specialization?: string;
    tier?: string;
    cursor?: string;
  }>;
}

export default async function PartnersDirectoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = await listPublicPartners({
    q: params.q,
    region: params.region,
    industry: params.industry,
    specialization: params.specialization,
    tier: params.tier,
    cursor: params.cursor,
    limit: 24,
  });

  const filters: Array<[string, string | undefined]> = [
    ["Region", params.region],
    ["Industry", params.industry],
    ["Specialization", params.specialization],
    ["Tier", params.tier],
  ].filter((f): f is [string, string] => Boolean(f[1])) as Array<[string, string]>;

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto max-w-7xl px-6 py-16 md:py-24 space-y-12">
        <header className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Partner directory
          </p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-950">
            Find a Google Cloud partner you can trust.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            {page.total.toLocaleString()} active partners. Filter by region,
            industry, or specialization. Click any card to see the public
            profile.
          </p>
        </header>

        <DirectoryFilters
          q={params.q}
          region={params.region}
          industry={params.industry}
          specialization={params.specialization}
          tier={params.tier}
        />

        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Filtering by</span>
            {filters.map(([label, value]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 text-slate-700"
              >
                <strong className="font-semibold">{label}:</strong> {value}
              </span>
            ))}
            <Link
              href="/partners"
              className="ml-auto text-slate-500 underline-offset-2 hover:underline"
            >
              Clear all
            </Link>
          </div>
        )}

        {page.partners.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            No partners match those filters.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.partners.map((p) => (
              <Link
                key={p.id}
                href={`/partners/${p.id}`}
                className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-900 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="size-14 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600 ring-1 ring-slate-200">
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logoUrl}
                        alt=""
                        className="size-full rounded-xl object-cover"
                      />
                    ) : (
                      p.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 group-hover:text-slate-950 truncate">
                      {p.name}
                    </h2>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mt-0.5">
                      {p.tier} · {p.headquarters ?? "Global"}
                    </p>
                  </div>
                </div>
                {p.tagline && (
                  <p className="mt-4 text-sm text-slate-600 line-clamp-3">
                    {p.tagline}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.specializations.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      {s}
                    </span>
                  ))}
                  {p.specializations.length > 3 && (
                    <span className="text-[11px] text-slate-500">
                      +{p.specializations.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {page.nextCursor && (
          <div className="flex justify-center">
            <Link
              href={`/partners?${new URLSearchParams({
                ...(params.q ? { q: params.q } : {}),
                ...(params.region ? { region: params.region } : {}),
                ...(params.industry ? { industry: params.industry } : {}),
                ...(params.specialization
                  ? { specialization: params.specialization }
                  : {}),
                ...(params.tier ? { tier: params.tier } : {}),
                cursor: page.nextCursor,
              }).toString()}`}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load more →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function DirectoryFilters(props: {
  q?: string;
  region?: string;
  industry?: string;
  specialization?: string;
  tier?: string;
}) {
  return (
    <form
      method="get"
      action="/partners"
      className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm md:grid-cols-6"
    >
      <input
        type="search"
        name="q"
        placeholder="Search partners…"
        defaultValue={props.q ?? ""}
        className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      <input
        name="region"
        placeholder="Region (EU, US…)"
        defaultValue={props.region ?? ""}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
      />
      <input
        name="industry"
        placeholder="Industry"
        defaultValue={props.industry ?? ""}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
      />
      <input
        name="specialization"
        placeholder="Specialization"
        defaultValue={props.specialization ?? ""}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Filter
      </button>
    </form>
  );
}
