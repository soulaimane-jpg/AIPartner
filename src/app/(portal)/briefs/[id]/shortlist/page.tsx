import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  ShortlistCompare,
  type ShortlistCard,
} from "@/components/brief/shortlist-compare";
import {
  isPartnerRevealed,
  serializeCompanyFacingShortlistCard,
} from "@/lib/serializers/firewall";
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

  const brief = await queryOne<{
    id: string;
    title: string;
    leadState: string;
  }>(
    'SELECT "id", "title", "leadState" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [id, session.user.id],
  );
  if (!brief) notFound();

  const matches = await query<{
    id: string;
    status: string;
    placeholderLabel: string | null;
    acceptedTermsAt: Date | null;
    customerPriority: number | null;
    partnerName: string;
    tagline: string | null;
    headquarters: string | null;
    officeLocations: string | null;
    regions: string | null;
    languages: string | null;
    specializations: string | null;
    expertiseAreas: string | null;
    caseStudies: string | null;
    gcpTier: string | null;
    tier: string | null;
    certifications: string | null;
  }>(
    `SELECT m."id", m."status", m."placeholderLabel", m."acceptedTermsAt", m."customerPriority",
            c."name" AS "partnerName",
            pp."tagline", pp."headquarters", pp."officeLocations", pp."regions", pp."languages",
            pp."specializations", pp."expertiseAreas", pp."caseStudies",
            pp."gcpTier", pp."tier", pp."certifications"
     FROM "Match" m
     JOIN "Company" c ON c."id" = m."partnerId"
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE m."briefId" = $1
     ORDER BY m."createdAt" ASC`,
    [id],
  );

  // Identity firewall (§8): the customer compares capability only until
  // the reveal event fires for the partner they selected.
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
    .map((m, index) => {
      const revealed = isPartnerRevealed({
        leadState: brief!.leadState,
        matchStatus: m.status,
      });
      const card = serializeCompanyFacingShortlistCard(
        {
          match: {
            id: m.id,
            status: m.status,
            placeholderLabel: m.placeholderLabel,
            acceptedTermsAt: m.acceptedTermsAt,
            customerPriority: m.customerPriority,
          },
          partner: { name: m.partnerName, tagline: m.tagline },
          profile: {
            headquarters: m.headquarters,
            officeLocations: safeJsonParse<string[]>(m.officeLocations ?? "[]", []),
            regions: safeJsonParse<string[]>(m.regions ?? "[]", []),
            languages: safeJsonParse<string[]>(m.languages ?? "[]", []),
            specializations: safeJsonParse<string[]>(m.specializations ?? "[]", []),
            expertiseAreas: safeJsonParse<string[]>(m.expertiseAreas ?? "[]", []),
            gcpTier: m.gcpTier ?? m.tier ?? null,
            certifications: safeJsonParse<
              { name: string; count?: number; level?: string }[]
            >(m.certifications ?? "[]", []),
            caseStudies: safeJsonParse<
              { title: string; industry?: string; summary?: string; link?: string }[]
            >(m.caseStudies ?? "[]", []),
          },
          fallbackIndex: index,
        },
        { revealed },
      );
      return { ...card, status: card.status as ShortlistCard["status"] };
    });

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
