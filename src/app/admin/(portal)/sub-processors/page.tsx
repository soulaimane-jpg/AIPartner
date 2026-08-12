/**
 * Admin → Sub-processors.
 *
 * CRUD over the public `SubProcessor` registry. Every change is mirrored
 * on `/trust` (server-side, revalidated by the actions) and on
 * `/api/v1/sub-processors`.
 *
 * Soft delete:
 *   - "Retire" sets `retiredAt`. Retired rows are hidden from public
 *     reads but stay visible to admins (the table is grouped by status).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubProcessorForm } from "./_components/sub-processor-form";
import { RetireButton } from "./_components/retire-button";

export const dynamic = "force-dynamic";

export default async function AdminSubProcessorsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const all = await query<Row>(
    `SELECT "id", "name", "url", "logoUrl", "purpose", "region",
            "certifications", "sortOrder", "effectiveFrom", "retiredAt", "createdAt"
     FROM "SubProcessor"
     ORDER BY "retiredAt" ASC NULLS FIRST, "region" ASC, "sortOrder" ASC`,
  );

  const active = all.filter((r) => !r.retiredAt);
  const retired = all.filter((r) => r.retiredAt);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Sub-processors
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          The vendor list that backs{" "}
          <Link href="/trust#sub-processors" className="underline">
            /trust
          </Link>{" "}
          and{" "}
          <Link href="/api/v1/sub-processors" className="font-mono underline">
            /api/v1/sub-processors
          </Link>
          . Changes propagate within 60 seconds.
        </p>
      </header>

      <SubProcessorForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No sub-processors registered yet.
          </Card>
        ) : (
          <SubProcessorTable rows={active} canRetire />
        )}
      </section>

      {retired.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Retired ({retired.length})
          </h2>
          <SubProcessorTable rows={retired} canRetire={false} />
        </section>
      )}
    </div>
  );
}

interface Row {
  id: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  purpose: string;
  region: string;
  certifications: string;
  sortOrder: number;
  effectiveFrom: Date;
  retiredAt: Date | null;
  createdAt: Date;
}

function SubProcessorTable({
  rows,
  canRetire,
}: {
  rows: Row[];
  canRetire: boolean;
}) {
  return (
    <div className="customer-table">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Vendor</th>
            <th className="px-4 py-2 font-medium">Purpose</th>
            <th className="px-4 py-2 font-medium">Region</th>
            <th className="px-4 py-2 font-medium">Certifications</th>
            <th className="px-4 py-2 font-medium">Since</th>
            {canRetire && (
              <th className="px-4 py-2 font-medium text-right">Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const certs = safeArray(r.certifications);
            return (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {r.name}
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-muted-foreground max-w-[420px] truncate">
                  {r.purpose}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{r.region}</Badge>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {certs.length > 0 ? (
                      certs.map((c) => (
                        <Badge
                          key={c}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {r.effectiveFrom.toISOString().slice(0, 10)}
                </td>
                {canRetire && (
                  <td className="px-4 py-2 text-right">
                    <RetireButton id={r.id} name={r.name} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function safeArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
