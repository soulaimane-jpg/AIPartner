import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMatchesPage() {
  const matches = await query<{
    id: string;
    briefId: string;
    status: string;
    updatedAt: Date;
    briefTitle: string;
    companyName: string;
    partnerName: string;
    proposalStatus: string | null;
    proposalTotalCost: number | null;
  }>(
    `SELECT m."id", m."briefId", m."status", m."updatedAt",
            b."title" AS "briefTitle", co."name" AS "companyName",
            pc."name" AS "partnerName",
            p."status" AS "proposalStatus", p."totalCost" AS "proposalTotalCost"
     FROM "Match" m
     JOIN "ProjectBrief" b ON b."id" = m."briefId"
     JOIN "Company" co ON co."id" = b."companyId"
     JOIN "Company" pc ON pc."id" = m."partnerId"
     LEFT JOIN "Proposal" p ON p."matchId" = m."id"
     ORDER BY m."updatedAt" DESC`,
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 uppercase italic">Matching <span className="text-blue-600">Core</span></h1>
        <p className="text-slate-500 font-mono text-xs ">
          Active Engineering Alignments & Deal Flow
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white px-8 py-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Synapse Monitor: {matches.length} Links Active
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {matches.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500 font-mono ">
              [ NO MATCHES ESTABLISHED ]
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-8 hover:bg-slate-50 transition-all group gap-8"
                >
                  <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {m.briefTitle}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-700" />
                      <div className="font-semibold text-lg text-blue-600 truncate">{m.partnerName}</div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-500 uppercase tracking-wider">
                      <span className="text-slate-600 font-bold">{m.companyName}</span>
                      <span>Updated {timeAgo(m.updatedAt)}</span>
                      {m.proposalTotalCost != null && (
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                          <span className="text-xs text-slate-600">VAL:</span> {formatCurrency(m.proposalTotalCost)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="border-slate-200 text-xs font-semibold  py-0.5 px-3">
                        {m.status}
                      </Badge>
                      {m.proposalStatus && (
                        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 text-xs font-semibold  py-0.5 px-3">
                          {m.proposalStatus}
                        </Badge>
                      )}
                    </div>
                    <Button asChild size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900">
                      <Link href={`/admin/briefs/${m.briefId}`}>
                        <ArrowUpRight className="h-5 w-5" />
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
