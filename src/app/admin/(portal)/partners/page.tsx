import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { safeJsonParse, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  const partners = await query<{
    id: string;
    name: string;
    createdAt: Date;
    tier: string | null;
    tagline: string | null;
    specializations: string | null;
    usersCount: number;
    matchesCount: number;
    proposalsCount: number;
  }>(
    `SELECT c."id", c."name", c."createdAt",
            pp."tier", pp."tagline", pp."specializations",
            (SELECT COUNT(*) FROM "User" u WHERE u."companyId" = c."id")::int AS "usersCount",
            (SELECT COUNT(*) FROM "Match" m WHERE m."partnerId" = c."id")::int AS "matchesCount",
            (SELECT COUNT(*) FROM "Proposal" pr WHERE pr."partnerId" = c."id")::int AS "proposalsCount"
     FROM "Company" c
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE c."kind" = 'PARTNER'
     ORDER BY c."createdAt" DESC`,
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 uppercase italic">Partner <span className="text-blue-600">Network</span></h1>
        <p className="text-slate-500 font-mono text-xs ">
          Verified Engineering Entities & Capability Matrix
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white px-8 py-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Network Status: {partners.length} Nodes Online
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {partners.map((p) => {
              const specs = safeJsonParse<string[]>(
                p.specializations ?? "[]",
                [],
              );
              return (
                <div
                  key={p.id}
                  className="flex flex-col p-8 hover:bg-slate-50 transition-all group gap-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-xs font-semibold tracking-widest px-3">
                          {p.tier ?? "MEMBER"}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-slate-500 font-mono uppercase tracking-wider">
                        {p.tagline ?? "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 ">
                      <div className="px-3 py-1 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 font-bold">{p.usersCount}</span> Operators
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-white border border-slate-200">
                        <span className="text-blue-600 font-bold">{p.matchesCount}</span> Engagements
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-white border border-slate-200">
                        <span className="text-blue-600 font-bold">{p.proposalsCount}</span> SOWs
                      </div>
                      <div className="px-3 py-1 rounded-lg bg-white border border-slate-200">
                        Joined {timeAgo(p.createdAt)}
                      </div>
                    </div>
                  </div>
                  
                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 mt-auto">
                      <span className="text-xs font-semibold text-slate-700  w-full mb-1">Capabilities:</span>
                      {specs.slice(0, 10).map((s) => (
                        <Badge key={s} variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 font-mono text-xs hover:border-blue-200 transition-colors">
                          {s.toUpperCase()}
                        </Badge>
                      ))}
                      {specs.length > 10 && (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-xs">
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
