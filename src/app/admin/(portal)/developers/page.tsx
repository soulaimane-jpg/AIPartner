/**
 * Admin → Developers.
 *
 * Single-pane management for the two programmatic surfaces shipped in
 * Slice S5: outbound **webhooks** and inbound **public API keys**.
 *
 * Why under /admin?
 *   - Customer/partner self-service for these will live under
 *     `/account/integrations` (later slice). For now, only the
 *     platform admin needs to provision them, debug deliveries, and
 *     rotate compromised credentials.
 *   - Admin RBAC grants `webhook.*` and `apikey.*` without an
 *     `isOwnCompany` predicate, so admins can act on any tenant.
 *
 * Tenant filter:
 *   - Defaults to "all tenants". A `?companyId=` query param scopes
 *     the page to one tenant — useful for support investigations.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Webhook, KeyRound, Activity, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApiKeysSection } from "./_components/api-keys-section";
import { WebhooksSection } from "./_components/webhooks-section";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ companyId?: string }>;
}

export default async function AdminDevelopersPage({ searchParams }: PageProps) {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const filterCompanyId = params.companyId;

  // Fetch tenants (paginated companies) for the tenant picker.
  const [companies, webhooks, apiKeys, recentFailures] = await Promise.all([
    query<{ id: string; name: string; kind: string }>(
      'SELECT "id", "name", "kind" FROM "Company" ORDER BY "name" ASC LIMIT 200',
    ),
    query<{
      id: string;
      companyId: string;
      url: string;
      description: string | null;
      events: string;
      status: string;
      lastDeliveryAt: Date | null;
      lastSuccessAt: Date | null;
      lastFailureAt: Date | null;
      consecutiveFails: number;
      createdAt: Date;
      companyName: string;
    }>(
      `SELECT w."id", w."companyId", w."url", w."description", w."events", w."status",
              w."lastDeliveryAt", w."lastSuccessAt", w."lastFailureAt", w."consecutiveFails",
              w."createdAt", c."name" AS "companyName"
       FROM "WebhookEndpoint" w JOIN "Company" c ON c."id" = w."companyId"
       ${filterCompanyId ? 'WHERE w."companyId" = $1' : ""}
       ORDER BY w."createdAt" DESC LIMIT 100`,
      filterCompanyId ? [filterCompanyId] : [],
    ),
    query<{
      id: string;
      companyId: string;
      name: string;
      prefix: string;
      scopes: string;
      status: string;
      lastUsedAt: Date | null;
      expiresAt: Date | null;
      rateLimitRpm: number | null;
      ipAllowlist: string;
      createdAt: Date;
      revokedAt: Date | null;
      companyName: string;
    }>(
      `SELECT k."id", k."companyId", k."name", k."prefix", k."scopes", k."status",
              k."lastUsedAt", k."expiresAt", k."rateLimitRpm", k."ipAllowlist",
              k."createdAt", k."revokedAt", c."name" AS "companyName"
       FROM "PublicApiKey" k JOIN "Company" c ON c."id" = k."companyId"
       ${filterCompanyId ? 'WHERE k."companyId" = $1' : ""}
       ORDER BY k."status" ASC, k."createdAt" DESC LIMIT 100`,
      filterCompanyId ? [filterCompanyId] : [],
    ),
    // Recent failed deliveries across the platform — a "what's broken
    // right now" surface for the on-call.
    query<{
      id: string;
      event: string;
      status: string;
      attempt: number;
      responseCode: number | null;
      createdAt: Date;
      endpointUrl: string;
      companyName: string;
    }>(
      `SELECT d."id", d."event", d."status", d."attempt", d."responseCode", d."createdAt",
              e."url" AS "endpointUrl", c."name" AS "companyName"
       FROM "WebhookDelivery" d
       JOIN "WebhookEndpoint" e ON e."id" = d."endpointId"
       JOIN "Company" c ON c."id" = e."companyId"
       WHERE d."status" IN ('failed', 'dlq')
       ORDER BY d."createdAt" DESC LIMIT 8`,
    ),
  ]);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" />
          Developers
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Provision API keys and webhook endpoints for any tenant. Every
          create / revoke / rotate event is recorded in the audit log.
        </p>
      </header>

      {/* Tenant filter */}
      <form
        method="get"
        action="/admin/developers"
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4"
      >
        <label className="text-sm font-medium space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Scope to tenant
          </div>
          <select
            name="companyId"
            defaultValue={filterCompanyId ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm min-w-[280px]"
          >
            <option value="">All tenants</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind.toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {filterCompanyId && (
          <Link
            href="/admin/developers"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Recent failures alert */}
      {recentFailures.length > 0 && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <h2 className="text-sm font-semibold text-amber-900">
              Recent delivery failures
            </h2>
          </div>
          <ul className="space-y-1.5 text-xs">
            {recentFailures.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-l-2 border-amber-300 pl-3"
              >
                <span className="font-mono text-amber-900">{d.event}</span>
                <span className="text-amber-800 truncate flex-1">
                  {d.companyName} · {d.endpointUrl}
                </span>
                <Badge variant="warning" className="shrink-0">
                  {d.responseCode ?? "net"} · att.{d.attempt}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* API Keys */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          API keys ({apiKeys.length})
        </h2>
        <ApiKeysSection
          companies={companies}
          defaultCompanyId={filterCompanyId ?? null}
          keys={apiKeys.map((k) => ({
            id: k.id,
            companyId: k.companyId,
            companyName: k.companyName,
            name: k.name,
            prefix: k.prefix,
            scopes: safeParseArray(k.scopes),
            status: k.status,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            expiresAt: k.expiresAt?.toISOString() ?? null,
            rateLimitRpm: k.rateLimitRpm,
            ipAllowlist: safeParseArray(k.ipAllowlist),
            createdAt: k.createdAt.toISOString(),
            revokedAt: k.revokedAt?.toISOString() ?? null,
          }))}
        />
      </section>

      {/* Webhooks */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          Webhooks ({webhooks.length})
        </h2>
        <WebhooksSection
          companies={companies}
          defaultCompanyId={filterCompanyId ?? null}
          endpoints={webhooks.map((w) => ({
            id: w.id,
            companyId: w.companyId,
            companyName: w.companyName,
            url: w.url,
            description: w.description,
            events: safeParseArray(w.events),
            status: w.status,
            lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
            lastSuccessAt: w.lastSuccessAt?.toISOString() ?? null,
            lastFailureAt: w.lastFailureAt?.toISOString() ?? null,
            consecutiveFails: w.consecutiveFails,
            createdAt: w.createdAt.toISOString(),
          }))}
        />
      </section>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-4">
        <Activity className="h-3.5 w-3.5" />
        OpenAPI spec lives at{" "}
        <Link href="/api/v1/openapi.json" className="font-mono underline">
          /api/v1/openapi.json
        </Link>
      </p>
    </div>
  );
}

function safeParseArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
