import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo, cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const users = await query<{
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: Date;
    companyName: string | null;
  }>(
    `SELECT u."id", u."name", u."email", u."role", u."createdAt",
            c."name" AS "companyName"
     FROM "User" u
     LEFT JOIN "Company" c ON c."id" = u."companyId"
     ORDER BY u."createdAt" DESC`,
  );

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div>
          <div className="eyebrow text-primary">Access Control & Platform Personnel Management</div>
          <h1 className="portal-page-title">Operator Database</h1>
        </div>
      </header>

      <Card className="customer-table bg-card shadow-elev-1">
        <CardHeader className="customer-panel-header">
          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
            Active Accounts: {users.length} Identities Verified
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-line">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-primary/5 transition-all group gap-6"
              >
                <div className="space-y-2">
                  <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{u.name ?? "UNKNOWN_OPERATOR"}</div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground uppercase tracking-wider">
                    <span className="text-primary font-bold">{u.email}</span>
                    <span className="text-foreground/70">{u.companyName ?? "NO_ORG"}</span>
                    <span>Verified {timeAgo(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold  py-1 px-4",
                      u.role === "ADMIN" 
                        ? "border-red-200 bg-red-50 text-red-700"
                        : u.role === "PARTNER"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground bg-card"
                    )}
                  >
                    {u.role}
                  </Badge>
                  <div className="text-xs text-foreground/80">
                    UID: {u.id.substring(0, 8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
