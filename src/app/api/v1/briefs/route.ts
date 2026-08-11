/**
 * Public API — Briefs collection.
 *
 *   GET  /api/v1/briefs   → list briefs visible to the authenticating key
 *   POST /api/v1/briefs   → create a new brief on behalf of the company
 *
 * Both endpoints are scoped to `auth.companyId` (the company that
 * provisioned the key); a key never sees data outside its tenant.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne, insertRow } from "@/lib/db";
import { authenticateApiKey } from "@/lib/public-api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_MAX = 100;

export async function GET(req: NextRequest) {
  const authResult = await authenticateApiKey(req, {
    requiredScopes: ["briefs:read"],
  });
  if (!authResult.ok) return authResult.response;

  const url = new URL(req.url);
  const limit = clamp(Number(url.searchParams.get("limit") ?? 25), 1, PAGE_MAX);
  const stage = url.searchParams.get("stage")?.toUpperCase() ?? undefined;
  const status = url.searchParams.get("status")?.toUpperCase() ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const params: unknown[] = [authResult.auth.companyId];
  const conds = ['"companyId" = $1'];
  if (stage) { params.push(stage); conds.push(`"stage" = $${params.length}`); }
  if (status) { params.push(status); conds.push(`"status" = $${params.length}`); }
  if (cursor) {
    // Keyset: rows strictly after the cursor in (updatedAt desc, id desc).
    params.push(cursor);
    conds.push(
      `("updatedAt", "id") < (SELECT "updatedAt", "id" FROM "ProjectBrief" WHERE "id" = $${params.length})`,
    );
  }
  params.push(limit + 1);
  const rows = await query<{
    id: string;
    title: string;
    stage: string;
    status: string;
    completion: number;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
  }>(
    `SELECT "id", "title", "stage", "status", "completion", "createdAt",
            "updatedAt", "submittedAt"
     FROM "ProjectBrief"
     WHERE ${conds.join(" AND ")}
     ORDER BY "updatedAt" DESC, "id" DESC
     LIMIT $${params.length}`,
    params,
  );

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({
    data,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  });
}

const createSchema = z.object({
  title: z.string().min(2).max(160),
  executiveSummary: z.string().max(8_000).optional(),
  services: z.array(z.string()).max(20).optional(),
  budgetRange: z.string().max(80).optional(),
  preferredLocation: z.string().max(120).optional(),
  targetGoLive: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await authenticateApiKey(req, {
    requiredScopes: ["briefs:write"],
  });
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", reason: "body-not-json" } },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  // We need *a* user inside the company to own the brief. The first
  // ADMIN of the tenant is the safest choice; fall back to the key's
  // creator if no ADMIN exists.
  const ownerCandidate = await queryOne<{ id: string }>(
    `SELECT "id" FROM "User"
     WHERE "companyId" = $1 AND "role" = 'ADMIN'
     ORDER BY "createdAt" ASC LIMIT 1`,
    [authResult.auth.companyId],
  );
  const creator = ownerCandidate
    ? ownerCandidate.id
    : (
        await queryOne<{ createdById: string }>(
          'SELECT "createdById" FROM "PublicApiKey" WHERE "id" = $1',
          [authResult.auth.keyId],
        )
      )?.createdById ?? null;

  if (!creator) {
    return NextResponse.json(
      { error: { code: "CONFLICT", reason: "no-eligible-owner" } },
      { status: 409 },
    );
  }

  const created = await insertRow<{
    id: string;
    title: string;
    stage: string;
    status: string;
    createdAt: Date;
  }>("ProjectBrief", {
    title: parsed.data.title,
    ownerId: creator,
    companyId: authResult.auth.companyId,
    executiveSummary: parsed.data.executiveSummary ?? null,
    services: parsed.data.services
      ? JSON.stringify(parsed.data.services)
      : "[]",
    budgetRange: parsed.data.budgetRange ?? null,
    preferredLocation: parsed.data.preferredLocation ?? null,
    targetGoLive: parsed.data.targetGoLive ?? null,
  });

  return NextResponse.json(
    {
      data: {
        id: created.id,
        title: created.title,
        stage: created.stage,
        status: created.status,
        createdAt: created.createdAt,
      },
    },
    { status: 201 },
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
