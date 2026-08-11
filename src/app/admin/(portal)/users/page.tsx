import { query } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 uppercase italic">Operator <span className="text-blue-600">Database</span></h1>
        <p className="text-slate-500 font-mono text-xs ">
          Access Control & Platform Personnel Management
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white px-8 py-6">
          <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Active Accounts: {users.length} Identities Verified
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-8 hover:bg-slate-50 transition-all group gap-6"
              >
                <div className="space-y-2">
                  <div className="font-bold text-xl text-slate-900 group-hover:text-blue-600 transition-colors">{u.name ?? "UNKNOWN_OPERATOR"}</div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-500 uppercase tracking-wider">
                    <span className="text-blue-600 font-bold">{u.email}</span>
                    <span className="text-slate-600">{u.companyName ?? "NO_ORG"}</span>
                    <span>Verified {timeAgo(u.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold  py-1 px-4",
                      u.role === "ADMIN" 
                        ? "border-red-500/30 text-red-600 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                        : u.role === "PARTNER"
                          ? "border-blue-200 text-blue-600 bg-blue-50"
                          : "border-slate-200 text-slate-500 bg-white"
                    )}
                  >
                    {u.role}
                  </Badge>
                  <div className="text-xs font-mono text-slate-700">
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
