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
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div>
          <div className="eyebrow text-primary">Active Engineering Alignments & Deal Flow</div>
          <h1 className="portal-page-title">Matching Core</h1>
        </div>
      </header>

      <Card className="customer-table bg-card shadow-elev-1">
        <CardHeader className="customer-panel-header">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
            Synapse Monitor: {matches.length} Links Active
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {matches.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground ">
              [ NO MATCHES ESTABLISHED ]
            </div>
          ) : (
            <div className="divide-y divide-line">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-primary/5 transition-all group gap-5"
                >
                  <div className="space-y-3 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {m.briefTitle}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-foreground/80" />
                      <div className="text-base font-semibold text-primary truncate">{m.partnerName}</div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground uppercase tracking-wider">
                      <span className="text-foreground/70 font-bold">{m.companyName}</span>
                      <span>Updated {timeAgo(m.updatedAt)}</span>
                      {m.proposalTotalCost != null && (
                        <span className="flex items-center gap-1.5 text-foreground font-semibold">
                          <span className="text-xs text-foreground/70">VAL:</span> {formatCurrency(m.proposalTotalCost)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="border-border text-xs font-semibold  py-0.5 px-3">
                        {m.status}
                      </Badge>
                      {m.proposalStatus && (
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-semibold  py-0.5 px-3">
                          {m.proposalStatus}
                        </Badge>
                      )}
                    </div>
                    <Button asChild size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground">
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
