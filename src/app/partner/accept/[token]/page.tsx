import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { queryOne } from "@/lib/db";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { TermsAcceptanceForm } from "@/components/partner/terms-acceptance-form";
import {
  PARTNER_TERMS_TEXT,
  PARTNER_TERMS_VERSION,
} from "@/lib/legal/partner-terms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead acceptance · AI Partner" };

/**
 * Public page — no session required. Renders the standard partner
 * terms of conditions and an inline accept / forward UI. The token
 * uniquely identifies a Match.
 */
export default async function PartnerAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const match = await queryOne<{
    acceptedTermsAt: Date | null;
    acceptedTermsName: string | null;
    outreachEmail: string | null;
    partnerName: string;
    briefTitle: string;
    preferredLocation: string | null;
    anonymizedProfile: string | null;
  }>(
    `SELECT m."acceptedTermsAt", m."acceptedTermsName", m."outreachEmail",
            c."name" AS "partnerName",
            b."title" AS "briefTitle", b."preferredLocation",
            cp."anonymizedProfile"
     FROM "Match" m
     JOIN "Company" c ON c."id" = m."partnerId"
     JOIN "ProjectBrief" b ON b."id" = m."briefId"
     LEFT JOIN "CustomerProfile" cp ON cp."companyId" = b."companyId"
     WHERE m."outreachToken" = $1`,
    [token],
  );

  if (!match) {
    return (
      <PublicShell>
        <div className="text-center space-y-4">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Link no longer valid
          </h1>
          <p className="text-[13.5px] text-muted-foreground max-w-md">
            This invitation may have been forwarded to a colleague or has
            expired. If you weren&apos;t expecting this, you can safely ignore it.
          </p>
          <Button asChild variant="outline" size="md">
            <Link href="/">Visit AI Partner</Link>
          </Button>
        </div>
      </PublicShell>
    );
  }

  if (match.acceptedTermsAt) {
    return (
      <PublicShell>
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            You&apos;re all set
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            {match.partnerName} accepted these terms
            {match.acceptedTermsName ? ` (signed by ${match.acceptedTermsName})` : ""}.
            Our team will share the full SoW shortly.
          </p>
          <Button asChild variant="outline" size="md">
            <Link href="/partner">Go to partner workspace</Link>
          </Button>
        </div>
      </PublicShell>
    );
  }

  // Anonymised customer descriptors for the partner-facing page.
  let customerIndustry = "Not specified";
  let customerRegion = match.preferredLocation ?? "Not specified";
  try {
    const a = JSON.parse(match.anonymizedProfile ?? "{}");
    if (a?.industry) customerIndustry = String(a.industry);
    if (a?.region) customerRegion = String(a.region);
  } catch {
    /* ignore */
  }

  return (
    <PublicShell>
      <TermsAcceptanceForm
        token={token}
        partnerName={match.partnerName}
        briefTitle={match.briefTitle}
        customerIndustry={customerIndustry}
        customerRegion={customerRegion}
        termsText={PARTNER_TERMS_TEXT}
        termsVersion={PARTNER_TERMS_VERSION}
        recipientEmail={match.outreachEmail ?? ""}
      />
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-cinema-bg border-b border-[hsl(268_25%_16%)]">
        <div className="container-app h-14 flex items-center">
          <BrandLockup size="sm" inverse />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}
