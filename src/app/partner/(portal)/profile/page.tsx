import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { PartnerProfileRow } from "@/lib/db/rows";
import { PartnerProfileForm } from "@/components/partner-profile-form";
import { LeadRoutingEmailCard } from "@/components/partner/lead-routing-email-card";
import { PartnerPageHeader } from "@/components/partner/partner-workspace-ui";
import { PillarEditor } from "@/components/partner/pillar-editor";
import { FreshnessCard } from "@/components/partner/freshness-card";
import { ChangeProposalsCard } from "@/components/partner/change-proposals-card";
import {
  loadPartnerPillarState,
  loadPendingChangeProposals,
} from "@/lib/partner-pillar-load";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PartnerProfilePage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect("/partner/login");

  const company = await queryOne<{ id: string; name: string }>(
    'SELECT "id", "name" FROM "Company" WHERE "id" = $1',
    [session.user.companyId],
  );
  if (!company) redirect("/partner/login");
  const profile = await queryOne<PartnerProfileRow>(
    'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
    [company.id],
  );
  const users = await query<{ id: string; name: string | null; email: string }>(
    'SELECT "id", "name", "email" FROM "User" WHERE "companyId" = $1',
    [company.id],
  );

  const [pillarState, proposals] = await Promise.all([
    loadPartnerPillarState(company.id),
    loadPendingChangeProposals(company.id),
  ]);

  const initial = {
    name: company.name,
    tagline: profile?.tagline ?? "",
    description: profile?.description ?? "",
    website: profile?.website ?? "",
    headquarters: profile?.headquarters ?? "",
    teamSize: profile?.teamSize ?? "",
    industry: profile?.industry ?? "",
    languages: safeJsonParse<string[]>(profile?.languages ?? "[]", []),
    regions: safeJsonParse<string[]>(profile?.regions ?? "[]", []),
    tier: (profile?.tier ?? "MEMBER") as "MEMBER" | "PARTNER" | "PREMIER",
    specializations: safeJsonParse<string[]>(
      profile?.specializations ?? "[]",
      [],
    ),
    expertiseAreas: safeJsonParse<string[]>(
      profile?.expertiseAreas ?? "[]",
      [],
    ),
    awards: safeJsonParse<{ title: string; year: number; issuer?: string }[]>(
      profile?.awards ?? "[]",
      [],
    ),
    directoryUrl: profile?.directoryUrl ?? "",
    caseStudies: safeJsonParse<
      {
        title: string;
        client: string;
        industry: string;
        summary: string;
        outcome: string;
        link: string;
      }[]
    >(profile?.caseStudies ?? "[]", []),
    keyClients: safeJsonParse<string[]>(
      profile?.keyClients ?? "[]",
      [],
    ),
    industryExperience: safeJsonParse<string[]>(
      profile?.industryExperience ?? "[]",
      [],
    ),
    certifications: safeJsonParse<
      { name: string; count: number; level: string }[]
    >(profile?.certifications ?? "[]", []),
    differentiators: safeJsonParse<string[]>(
      profile?.differentiators ?? "[]",
      [],
    ),
    officeLocations: safeJsonParse<string[]>(
      profile?.officeLocations ?? "[]",
      [],
    ),
    serviceModels: safeJsonParse<string[]>(
      profile?.serviceModels ?? "[]",
      [],
    ),
    gcpTier: profile?.gcpTier ?? "",
    partnerSince: profile?.partnerSince ?? "",
  };

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <PartnerPageHeader
        eyebrow="Company profile"
        title="Present your strongest capabilities"
        description="Keep company, Google Cloud, delivery, and team details accurate so matching can prioritize work your team is built to win."
      />

      <FreshnessCard freshness={pillarState.freshness} />

      <ChangeProposalsCard proposals={proposals} />

      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Opportunity routing</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Choose the shared inbox that should receive new match invitations.</p>
        </div>
        <LeadRoutingEmailCard initialEmail={profile?.leadRoutingEmail ?? ""} />
      </section>

      {/* The five pillars are the data clients actually compare on, so they
          lead. Company identity and team management follow below. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Capability profile</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Structured answers here drive matching and let clients compare you against other partners like-for-like.
          </p>
        </div>
        <PillarEditor
          initialValues={pillarState.values}
          tagLabels={pillarState.tagLabels}
          initialStrength={pillarState.profile?.profileStrength ?? 0}
        />
      </section>

      <section className="space-y-3 border-t border-line pt-7">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Company details and team</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Identity, awards, and who in your organisation can act on opportunities.
          </p>
        </div>
        <PartnerProfileForm initial={initial} teamMembers={users} />
      </section>
    </div>
  );
}
