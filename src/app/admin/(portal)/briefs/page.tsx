import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBriefsPage() {
  const briefs = await query<{
    id: string;
    title: string;
    stage: string;
    updatedAt: Date;
    companyName: string;
    ownerEmail: string | null;
    matchesCount: number;
    proposalsCount: number;
  }>(
    `SELECT b."id", b."title", b."stage", b."updatedAt",
            c."name" AS "companyName", u."email" AS "ownerEmail",
            (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id")::int AS "matchesCount",
            (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id")::int AS "proposalsCount"
     FROM "ProjectBrief" b
     JOIN "Company" c ON c."id" = b."companyId"
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     ORDER BY b."updatedAt" DESC`,
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 uppercase italic">Opportunity <span className="text-blue-600">Registry</span></h1>
        <p className="text-slate-500 font-mono text-xs ">
          Global Project Inventory & Intelligence
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              System Scan: {briefs.length} Units Found
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {briefs.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500 font-mono ">
              [ NO OPPORTUNITIES DETECTED ]
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {briefs.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-8 hover:bg-slate-50 transition-all group gap-6"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{b.title}</h3>
                      <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-xs font-semibold  py-0.5">
                        {b.stage}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-500 uppercase tracking-wider">
                      <span className="text-slate-600 font-bold">{b.companyName}</span>
                      <span>{b.ownerEmail}</span>
                      <span className="flex items-center gap-1.5"><span className="text-blue-600">#</span> {b.matchesCount} matches</span>
                      <span className="flex items-center gap-1.5"><span className="text-blue-600">#</span> {b.proposalsCount} proposals</span>
                      <span>Updated {timeAgo(b.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge variant="outline" className="border-slate-200 text-slate-500 text-xs font-mono">
                      ID: {b.id.substring(0, 8)}
                    </Badge>
                    <Button asChild size="sm" variant="outline" className="h-10 px-6 border-slate-200 bg-white text-slate-900 hover:bg-white/10 hover:border-slate-200 font-bold  text-xs">
                      <Link href={`/admin/briefs/${b.id}`}>
                        Decrypt Brief <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
