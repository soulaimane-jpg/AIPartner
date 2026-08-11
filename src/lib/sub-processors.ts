/**
 * Sub-processor registry — server-side reader for `/trust` and the
 * public API. The list is admin-editable through the cockpit; this
 * module just consumes it.
 *
 * Soft-deletes (`retiredAt`) are filtered out by default; pass
 * `includeRetired: true` for the admin view.
 *
 * Grouping: callers usually want `{ region: SubProcessor[] }` shape;
 * we provide both flat and grouped helpers.
 */

import "server-only";
import { query } from "@/lib/db";

export interface SubProcessorView {
  id: string;
  name: string;
  url: string | null;
  purpose: string;
  region: string;
  certifications: string[];
  logoUrl: string | null;
  effectiveFrom: Date;
}

export async function listSubProcessors(
  options: { includeRetired?: boolean } = {},
): Promise<SubProcessorView[]> {
  const rows = await query<{
    id: string;
    name: string;
    url: string | null;
    purpose: string;
    region: string;
    certifications: string;
    logoUrl: string | null;
    effectiveFrom: Date;
  }>(
    `SELECT "id", "name", "url", "purpose", "region", "certifications", "logoUrl", "effectiveFrom"
     FROM "SubProcessor"
     WHERE ($1::boolean OR "retiredAt" IS NULL)
     ORDER BY "region" ASC, "sortOrder" ASC, "name" ASC`,
    [options.includeRetired ?? false],
  );
  return rows.map((r) => ({
    ...r,
    certifications: safeParseStringArray(r.certifications),
  }));
}

export async function groupSubProcessorsByRegion(): Promise<
  Record<string, SubProcessorView[]>
> {
  const flat = await listSubProcessors();
  return flat.reduce<Record<string, SubProcessorView[]>>((acc, row) => {
    (acc[row.region] ??= []).push(row);
    return acc;
  }, {});
}

function safeParseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
