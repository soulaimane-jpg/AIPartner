import { Sparkles } from "lucide-react";
import { query } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { AdminCreateGoogler } from "@/components/admin-create-googler";

export const dynamic = "force-dynamic";

export default async function AdminGooglersPage() {
  const googlers = await query<{
    id: string;
    name: string | null;
    email: string;
    jobTitle: string | null;
    location: string | null;
    createdAt: Date;
    leadsTotal: number;
    leadsClaimed: number;
    leadsWon: number;
  }>(
    `SELECT u."id", u."name", u."email", u."jobTitle", u."location", u."createdAt",
       (SELECT COUNT(*) FROM "Lead" l WHERE l."googlerId" = u."id")::int AS "leadsTotal",
       (SELECT COUNT(*) FROM "Lead" l WHERE l."googlerId" = u."id" AND l."status" <> 'INVITED')::int AS "leadsClaimed",
       (SELECT COUNT(*) FROM "Lead" l WHERE l."googlerId" = u."id" AND l."status" = 'WON')::int AS "leadsWon"
     FROM "User" u
     WHERE u."role" = 'GOOGLER'
     ORDER BY u."createdAt" DESC`,
  );

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Google Sales Reps
          </div>
          <h1 className="portal-page-title mt-1">
            Googler accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Googlers refer customers into AI Partner. They don&apos;t self-register
            — you provision the account here and share the credentials out of
            band.
          </p>
        </div>
      </header>

      <AdminCreateGoogler />

      <div className="customer-table">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            Provisioned Googlers
          </div>
          <div className="text-xs text-muted-foreground">
            {googlers.length} {googlers.length === 1 ? "account" : "accounts"}
          </div>
        </div>
        {googlers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No Googler accounts yet. Provision one above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {googlers.map((g) => {
              const leads = g.leadsTotal;
              const claimed = g.leadsClaimed;
              const won = g.leadsWon;
              return (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center gap-6 px-6 py-4 hover:bg-secondary/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      {g.name ?? "Unnamed Googler"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.email} · {g.jobTitle ?? "Google Sales Representative"}
                      {g.location ? ` · ${g.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <Metric label="Leads" value={leads} />
                    <Metric label="Activated" value={claimed} tone="primary" />
                    <Metric label="Won" value={won} tone="success" />
                    <span className="text-muted-foreground">
                      Joined {timeAgo(g.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`font-bold tabular-nums ${toneClass}`}>{value}</span>
      <span className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
        {label}
      </span>
    </span>
  );
}
