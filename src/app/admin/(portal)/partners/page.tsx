import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { safeJsonParse, timeAgo } from "@/lib/utils";
import { assessDomainEvidence } from "@/lib/partner-verification";
import {
  PartnerVerificationQueue,
  type PendingPartner,
} from "@/components/admin/partner-verification-queue";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  const partners = await query<{
    id: string;
    name: string;
    createdAt: Date;
    tier: string | null;
    tagline: string | null;
    specializations: string | null;
    verificationStatus: string;
    rejectionReason: string | null;
    signupEmailDomain: string | null;
    website: string | null;
    directoryUrl: string | null;
    contactEmails: string[] | null;
    usersCount: number;
    matchesCount: number;
    proposalsCount: number;
  }>(
    `SELECT c."id", c."name", c."createdAt",
            pp."tier", pp."tagline", pp."specializations", pp."directoryUrl",
            c."verificationStatus", c."rejectionReason", c."signupEmailDomain", c."website",
            (SELECT ARRAY_AGG(u."email") FROM "User" u WHERE u."companyId" = c."id") AS "contactEmails",
            (SELECT COUNT(*) FROM "User" u WHERE u."companyId" = c."id")::int AS "usersCount",
            (SELECT COUNT(*) FROM "Match" m WHERE m."partnerId" = c."id")::int AS "matchesCount",
            (SELECT COUNT(*) FROM "Proposal" pr WHERE pr."partnerId" = c."id")::int AS "proposalsCount"
     FROM "Company" c
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE c."kind" = 'PARTNER'
     ORDER BY c."createdAt" DESC`,
  );

  const pending: PendingPartner[] = partners
    .filter((p) => p.verificationStatus === "PENDING")
    .map((p) => {
      const evidence = p.signupEmailDomain
        ? assessDomainEvidence({
            email: `noreply@${p.signupEmailDomain}`,
            website: p.website,
            directoryUrl: p.directoryUrl,
          })
        : null;
      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        signupEmailDomain: p.signupEmailDomain,
        website: p.website,
        directoryUrl: p.directoryUrl,
        domainMatches: evidence?.matched ?? false,
        domainReason: evidence?.reason ?? "no_website_on_file",
        contactEmails: p.contactEmails ?? [],
        usersCount: p.usersCount,
      };
    });

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div>
          <div className="eyebrow text-primary">Verified Engineering Entities & Capability Matrix</div>
          <h1 className="portal-page-title">Partner Network</h1>
        </div>
      </header>

      <PartnerVerificationQueue partners={pending} />

      <Card className="customer-table bg-card shadow-elev-1">
        <CardHeader className="customer-panel-header">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
            Network Status: {partners.length} Nodes Online
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-line">
            {partners.map((p) => {
              const specs = safeJsonParse<string[]>(
                p.specializations ?? "[]",
                [],
              );
              return (
                <div
                  key={p.id}
                  className="flex flex-col p-5 hover:bg-primary/5 transition-all group gap-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-widest px-3">
                          {p.tier ?? "MEMBER"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold tracking-widest px-3 ${
                            p.verificationStatus === "APPROVED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : p.verificationStatus === "REJECTED"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {p.verificationStatus}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {p.tagline ?? "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/70 ">
                      <div className="px-3 py-1 rounded-lg bg-card border border-border">
                        <span className="text-muted-foreground font-bold">{p.usersCount}</span> Operators
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-card border border-border">
                        <span className="text-primary font-bold">{p.matchesCount}</span> Engagements
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-card border border-border">
                        <span className="text-primary font-bold">{p.proposalsCount}</span> SOWs
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-card border border-border">
                        Joined {timeAgo(p.createdAt)}
                      </div>
                    </div>
                  </div>
                  
                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-auto">
                      <span className="text-xs font-semibold text-foreground/80  w-full mb-1">Capabilities:</span>
                      {specs.slice(0, 10).map((s) => (
                        <Badge key={s} variant="outline" className="border-border bg-secondary/50 text-muted-foreground text-xs hover:border-primary/30 transition-colors">
                          {s.toUpperCase()}
                        </Badge>
                      ))}
                      {specs.length > 10 && (
                        <Badge variant="outline" className="border-border bg-secondary/50 text-foreground/70 text-xs">
                          +{specs.length - 10} MORE
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
