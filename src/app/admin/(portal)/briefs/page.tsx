import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";

export default async function AdminBriefsPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

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
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div>
          <div className="eyebrow text-primary">Global Project Inventory & Intelligence</div>
          <h1 className="portal-page-title">Opportunity Registry</h1>
        </div>
      </header>

      <Card className="customer-table bg-card shadow-elev-1">
        <CardHeader className="customer-panel-header">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
              System Scan: {briefs.length} Units Found
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {briefs.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground ">
              [ NO OPPORTUNITIES DETECTED ]
            </div>
          ) : (
            <div className="divide-y divide-line">
              {briefs.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-primary/5 transition-all group gap-6"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">{b.title}</h3>
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-semibold  py-0.5">
                        {b.stage}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground uppercase tracking-wider">
                      <span className="text-foreground/70 font-bold">{b.companyName}</span>
                      <span>{b.ownerEmail}</span>
                      <span className="flex items-center gap-1.5"><span className="text-primary">#</span> {b.matchesCount} matches</span>
                      <span className="flex items-center gap-1.5"><span className="text-primary">#</span> {b.proposalsCount} proposals</span>
                      <span>Updated {timeAgo(b.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs font-mono">
                      ID: {b.id.substring(0, 8)}
                    </Badge>
                    <Button asChild size="sm" variant="outline" className="h-10 px-6 border-border bg-card text-foreground hover:bg-card/10 hover:border-border font-bold  text-xs">
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
