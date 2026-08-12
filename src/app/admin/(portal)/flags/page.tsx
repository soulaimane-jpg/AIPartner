import { redirect } from "next/navigation";
import { Flag, Clock, History, Mail, Percent, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FeatureFlagRow, FeatureFlagChangeRow } from "@/lib/db/rows";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlagFormCard } from "./_components/flag-form";
import { FlagToggle } from "./_components/flag-toggle";
import { DeleteFlagButton } from "./_components/delete-flag-button";

export const dynamic = "force-dynamic";

interface SerialisedAudience {
  roles?: string[];
  userIds?: string[];
  companyIds?: string[];
}

function parseAudience(s: string): SerialisedAudience {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function AdminFlagsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const flags = await query<FeatureFlagRow>(
    'SELECT * FROM "FeatureFlag" ORDER BY "enabled" DESC, "key" ASC',
  );

  // Latest 5 changes per flag, joined in a second query (cheaper than
  // groupBy + lateral on small N).
  const recentChanges = await query<FeatureFlagChangeRow>(
    'SELECT * FROM "FeatureFlagChange" ORDER BY "createdAt" DESC LIMIT 50',
  );

  const changesByKey = new Map<string, typeof recentChanges>();
  for (const c of recentChanges) {
    const list = changesByKey.get(c.flagKey) ?? [];
    list.push(c);
    changesByKey.set(c.flagKey, list);
  }

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title flex items-center gap-2">
          <Flag className="h-6 w-6 text-primary" />
          Feature flags
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Server-side flags evaluated per request. Toggle for instant
          kill-switch, or roll out gradually with a percentage.
          Every change is recorded against the actor.
        </p>
      </header>

      <FlagFormCard />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active ({flags.length})
        </h2>

        {flags.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No feature flags yet. Create one above to get started.
          </Card>
        ) : (
          <div className="grid gap-3">
            {flags.map((f) => {
              const audience = parseAudience(f.audience);
              const changes = changesByKey.get(f.key) ?? [];
              return (
                <Card key={f.key} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-bold">
                          {f.key}
                        </code>
                        <Badge
                          variant={f.enabled ? "default" : "secondary"}
                        >
                          {f.enabled ? "ON" : "OFF"}
                        </Badge>
                        {f.expiresAt && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3" /> Expires{" "}
                            {fmtDate(f.expiresAt)}
                          </Badge>
                        )}
                      </div>
                      {f.description && (
                        <p className="text-sm text-muted-foreground">
                          {f.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          {f.rolloutPct}% rollout
                        </span>
                        {audience.roles && audience.roles.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {audience.roles.join(", ")}
                          </span>
                        )}
                        {f.ownerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {f.ownerEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <FlagToggle flagKey={f.key} enabled={f.enabled} />
                      <DeleteFlagButton flagKey={f.key} />
                    </div>
                  </div>

                  {changes.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground flex items-center gap-1.5 select-none">
                        <History className="h-3.5 w-3.5" />
                        Last {changes.length} change
                        {changes.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="pt-2 space-y-1">
                        {changes.map((c) => (
                          <li
                            key={c.id}
                            className="flex justify-between gap-3 border-l-2 pl-2"
                          >
                            <span className="font-mono text-muted-foreground">
                              {fmtDate(c.createdAt)}
                            </span>
                            <span className="flex-1 truncate">
                              {c.reason ?? "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
