/**
 * Server Component that renders an audit log feed.
 *
 * Reusable across:
 *   - /admin/audit (full feed with cursor pagination)
 *   - Brief preview pages (`<AuditLogTimeline targetType="ProjectBrief" targetId={…} />`)
 *   - Match details
 *   - Partner profile (sensitive operations)
 *   - User settings (own activity history)
 *
 * The component runs server-side, so it queries the DB directly. For
 * dynamic feeds (load-more), wrap it in a client component that calls
 * a Server Action backed by an AuditLog query.
 */

import { Activity, Clock } from "lucide-react";
import { query } from "@/lib/db";
import type { AuditLogRow } from "@/lib/db/rows";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface AuditLogTimelineProps {
  /** Filter to a specific resource (e.g. one brief). */
  targetType?: string;
  targetId?: string;
  /** Filter to actions performed by a specific user. */
  actorId?: string;
  /** Tenant scope. */
  companyId?: string;
  /** Filter by `kind` prefix, e.g. "action.brief.". */
  kindPrefix?: string;
  /** Maximum rows to display. Default 50. */
  limit?: number;
  /** Show actor name + email in each row. Default true. */
  showActor?: boolean;
}

function fmtRelative(d: Date): string {
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(d);
}

function colourForKind(kind: string): "default" | "outline" | "secondary" {
  if (kind.endsWith(".failed")) return "secondary";
  if (kind.startsWith("action.")) return "default";
  return "outline";
}

export async function AuditLogTimeline({
  targetType,
  targetId,
  actorId,
  companyId,
  kindPrefix,
  limit = 50,
  showActor = true,
}: AuditLogTimelineProps) {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (targetType) { params.push(targetType); conds.push(`"targetType" = $${params.length}`); }
  if (targetId) { params.push(targetId); conds.push(`"targetId" = $${params.length}`); }
  if (actorId) { params.push(actorId); conds.push(`"actorId" = $${params.length}`); }
  if (companyId) { params.push(companyId); conds.push(`"companyId" = $${params.length}`); }
  if (kindPrefix) { params.push(`${kindPrefix}%`); conds.push(`"kind" LIKE $${params.length}`); }
  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  params.push(limit);
  const rows = await query<AuditLogRow>(
    `SELECT * FROM "AuditLog" ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length}`,
    params,
  );

  // Best-effort actor lookup. We don't join in the query so the timeline
  // works even when the user has been hard-deleted.
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x)),
  );
  const actors = actorIds.length
    ? await query<{ id: string; name: string | null; email: string; role: string }>(
        'SELECT "id", "name", "email", "role" FROM "User" WHERE "id" = ANY($1)',
        [actorIds],
      )
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Activity className="h-4 w-4" /> No activity recorded yet.
      </Card>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((r) => {
        const actor = r.actorId ? actorById.get(r.actorId) : null;
        return (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-lg border bg-card p-3"
          >
            <div className="mt-0.5">
              <Badge variant={colourForKind(r.kind)} className="font-mono">
                {r.kind}
              </Badge>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {showActor && (
                <div className="text-sm">
                  {actor ? (
                    <>
                      <span className="font-medium">
                        {actor.name ?? actor.email}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        ({actor.role})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">
                      System / deleted user
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <time dateTime={r.createdAt.toISOString()}>
                  {fmtRelative(r.createdAt)}
                </time>
                {r.targetType && r.targetId && (
                  <span className="font-mono">
                    {r.targetType}#{r.targetId.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
