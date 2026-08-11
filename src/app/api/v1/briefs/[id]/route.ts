/**
 * Public API — Brief detail.
 *
 *   GET /api/v1/briefs/:id  → fetch one brief (scoped to the key's tenant)
 */

import { NextResponse, type NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { authenticateApiKey } from "@/lib/public-api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiKey(req, {
    requiredScopes: ["briefs:read"],
  });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;

  const row = await queryOne<{
    id: string;
    title: string;
    stage: string;
    status: string;
    completion: number;
    executiveSummary: string | null;
    scopeRequirements: string;
    successCriteria: string;
    budgetRange: string | null;
    preferredLocation: string | null;
    targetGoLive: string | null;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT "id", "title", "stage", "status", "completion", "executiveSummary",
            "scopeRequirements", "successCriteria", "budgetRange", "preferredLocation",
            "targetGoLive", "submittedAt", "createdAt", "updatedAt"
     FROM "ProjectBrief" WHERE "id" = $1 AND "companyId" = $2`,
    [id, authResult.auth.companyId],
  );

  if (!row) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  // Convert JSON string columns to arrays for the wire shape — the API
  // contract surfaces structured types, not the storage encoding.
  return NextResponse.json({
    data: {
      ...row,
      scopeRequirements: safeArray(row.scopeRequirements),
      successCriteria: safeArray(row.successCriteria),
    },
  });
}

function safeArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
