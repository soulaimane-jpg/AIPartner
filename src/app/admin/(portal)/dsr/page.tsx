import { ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/require-role";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data subject requests · Admin" };

/** GDPR art. 12 — 30 calendar days from request to completion. */
const SLA_DAYS = 30;

/**
 * DSR queue with the statutory clock made visible.
 *
 * Export and erase requests are fulfilled automatically by
 * `lib/jobs/dsr.ts`; `rectify` is deliberately manual because only a
 * person can judge what is inaccurate. Before this screen existed there
 * was no way to see that a request was approaching — or past — its
 * deadline.
 */
export default async function AdminDsrPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const rows = await query<{
    id: string;
    kind: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    completedAt: Date | null;
    ageDays: number;
    userEmail: string;
    userRole: string;
  }>(
    `SELECT d."id", d."kind", d."status", d."notes", d."createdAt", d."completedAt",
            EXTRACT(EPOCH FROM (NOW() - d."createdAt")) / 86400 AS "ageDays",
            u."email" AS "userEmail", u."role" AS "userRole"
       FROM "DsrRequest" d
       JOIN "User" u ON u."id" = d."userId"
      ORDER BY
        CASE WHEN d."status" IN ('queued','processing') THEN 0 ELSE 1 END,
        d."createdAt" ASC
      LIMIT 200`,
  );

  const open = rows.filter(
    (r) => r.status === "queued" || r.status === "processing",
  );
  const overdue = open.filter((r) => Number(r.ageDays) > SLA_DAYS);
  const dueSoon = open.filter(
    (r) => Number(r.ageDays) > SLA_DAYS - 7 && Number(r.ageDays) <= SLA_DAYS,
  );

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span
            className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15"
            aria-hidden
          >
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">Privacy</div>
            <h1 className="portal-page-title">Data subject requests</h1>
            <p className="portal-page-description">
              GDPR art. 15/17/20. Export and erasure run automatically;
              rectification needs a human decision. Statutory deadline is{" "}
              {SLA_DAYS} days.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open" value={open.length} />
        <Kpi label="Overdue" value={overdue.length} tone="danger" />
        <Kpi label="Due within 7d" value={dueSoon.length} tone="warning" />
        <Kpi label="Total" value={rows.length} />
      </div>

      {overdue.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-[13px] text-red-900">
            <strong>
              {overdue.length} request{overdue.length === 1 ? "" : "s"} past the{" "}
              {SLA_DAYS}-day deadline.
            </strong>{" "}
            This is a reportable compliance breach. Resolve immediately.
          </div>
        </div>
      )}

      <div className="customer-table overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm italic text-muted-foreground">
            No data subject requests yet.
          </div>
        ) : (
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface-sunk">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-5 py-3 sm:px-6">Subject</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const age = Number(r.ageDays);
                const isOpen =
                  r.status === "queued" || r.status === "processing";
                const late = isOpen && age > SLA_DAYS;
                const soon = isOpen && !late && age > SLA_DAYS - 7;
                return (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-primary/5"
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="font-medium text-foreground">
                        {r.userEmail}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {r.userRole}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className="text-[11px]">
                        {r.kind}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={
                          late
                            ? "font-semibold text-red-700"
                            : soon
                              ? "font-semibold text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1">
                            {late || soon ? (
                              <Clock className="h-3 w-3" />
                            ) : null}
                            {Math.floor(age)}d
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      <span className="line-clamp-2 max-w-[26ch]">
                        {r.notes ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="customer-panel px-4 py-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          value > 0 && tone === "danger"
            ? "text-red-700"
            : value > 0 && tone === "warning"
              ? "text-amber-700"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "complete"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "border-border bg-secondary text-muted-foreground"
        : status === "processing"
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <Badge variant="outline" className={`text-[11px] ${cls}`}>
      {status}
    </Badge>
  );
}
