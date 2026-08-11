import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  ShortlistCompare,
  type ShortlistCard,
} from "@/components/brief/shortlist-compare";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shortlist · AI Partner" };

export default async function BriefShortlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const brief = await queryOne<{ id: string; title: string }>(
    'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [id, session.user.id],
  );
  if (!brief) notFound();

  const matches = await query<{
    id: string;
    status: string;
    acceptedTermsAt: Date | null;
    customerPriority: number | null;
    partnerName: string;
    tagline: string | null;
    headquarters: string | null;
    officeLocations: string | null;
    languages: string | null;
    specializations: string | null;
    expertiseAreas: string | null;
    caseStudies: string | null;
    gcpTier: string | null;
    tier: string | null;
    certifications: string | null;
  }>(
    `SELECT m."id", m."status", m."acceptedTermsAt", m."customerPriority",
            c."name" AS "partnerName",
            pp."tagline", pp."headquarters", pp."officeLocations", pp."languages",
            pp."specializations", pp."expertiseAreas", pp."caseStudies",
            pp."gcpTier", pp."tier", pp."certifications"
     FROM "Match" m
     JOIN "Company" c ON c."id" = m."partnerId"
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE m."briefId" = $1
     ORDER BY m."createdAt" ASC`,
    [id],
  );

  const cards: ShortlistCard[] = matches
    .filter((m) =>
      [
        "INVITED",
        "PARTNER_ACCEPTED",
        "SHORTLISTED",
        "IN_FINAL_THREE",
        "PARTNER_DECLINED",
      ].includes(m.status),
    )
    .map((m) => ({
      matchId: m.id,
      partnerName: m.partnerName,
      partnerTagline: m.tagline ?? null,
      status: m.status as ShortlistCard["status"],
      acceptedAt: m.acceptedTermsAt?.toISOString() ?? null,
      customerPriority: m.customerPriority,
      headquarters: m.headquarters ?? null,
      officeLocations: safeJsonParse<string[]>(m.officeLocations ?? "[]", []),
      languages: safeJsonParse<string[]>(m.languages ?? "[]", []),
      specializations: safeJsonParse<string[]>(m.specializations ?? "[]", []),
      expertiseAreas: safeJsonParse<string[]>(m.expertiseAreas ?? "[]", []),
      caseStudies: safeJsonParse<
        { title: string; industry?: string; summary?: string; link?: string }[]
      >(m.caseStudies ?? "[]", []),
      gcpTier: m.gcpTier ?? m.tier ?? null,
      certifications: safeJsonParse<
        { name: string; count?: number; level?: string }[]
      >(m.certifications ?? "[]", []),
    }));

  if (cards.length === 0) {
    return (
      <div className="page-container-wide pt-10 pb-20 text-center space-y-4">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Your shortlist isn&apos;t ready yet
        </h1>
        <p className="text-[13.5px] text-muted-foreground max-w-md mx-auto">
          The AI Partner team is still reaching out to your top 5 matches.
          We&apos;ll email you the moment partners start accepting the terms.
        </p>
        <Link
          href={`/briefs/${id}/preview`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-1 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to brief
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container-wide space-y-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href={`/briefs/${id}/preview`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to brief
      </Link>
      <ShortlistCompare
        briefId={brief.id}
        briefTitle={brief.title}
        cards={cards}
      />
    </div>
  );
}
