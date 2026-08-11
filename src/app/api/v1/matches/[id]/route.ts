/**
 * Public API — Match detail.
 *
 *   GET    /api/v1/matches/:id   → fetch a match (any party in the deal
 *                                  can read it, as long as the API key
 *                                  belongs to one of those companies).
 *   PATCH  /api/v1/matches/:id   → partner updates status (accept/decline)
 *
 * Status transitions allowed via PATCH:
 *   INVITED  → ACCEPTED, DECLINED
 *   ACCEPTED → (no public transitions — proposals flow handles it)
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { queryOne, updateRows } from "@/lib/db";
import { authenticateApiKey } from "@/lib/public-api/auth";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiKey(req, {
    requiredScopes: ["matches:read"],
  });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  const row = await fetchMatchInTenant(id, authResult.auth.companyId);
  if (!row) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: row });
}

/**
 * Public API uses friendlier verbs than the internal storage values
 * (`PARTNER_ACCEPTED`/`PARTNER_DECLINED`). We translate before
 * persisting so consumers don't need to know our internal taxonomy.
 */
const PUBLIC_TO_INTERNAL_STATUS = {
  ACCEPTED: "PARTNER_ACCEPTED",
  DECLINED: "PARTNER_DECLINED",
} as const;

const patchSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  declineReason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiKey(req, {
    requiredScopes: ["matches:write"],
  });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", reason: "body-not-json" } },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
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

  const match = await queryOne<{
    id: string;
    briefId: string;
    partnerId: string;
    status: string;
    briefCompanyId: string;
  }>(
    `SELECT m."id", m."briefId", m."partnerId", m."status",
            b."companyId" AS "briefCompanyId"
     FROM "Match" m JOIN "ProjectBrief" b ON b."id" = m."briefId"
     WHERE m."id" = $1`,
    [id],
  );
  if (!match) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  // Only the partner side can update via this endpoint.
  if (match.partnerId !== authResult.auth.companyId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", reason: "not-partner" } },
      { status: 403 },
    );
  }
  if (match.status !== "INVITED") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          reason: `current-status-${match.status.toLowerCase()}`,
        },
      },
      { status: 409 },
    );
  }

  const patchData: Record<string, unknown> = {
    status: PUBLIC_TO_INTERNAL_STATUS[parsed.data.status],
  };
  if (parsed.data.status === "DECLINED" && parsed.data.declineReason) {
    patchData.declineReason = parsed.data.declineReason;
  }
  const [updated] = await updateRows<{
    id: string;
    status: string;
    updatedAt: Date;
  }>("Match", { id }, patchData);

  void dispatchWebhook(
    parsed.data.status === "ACCEPTED" ? "match.accepted" : "match.declined",
    {
      matchId: match.id,
      briefId: match.briefId,
      partnerId: match.partnerId,
    },
    { companyIds: [match.briefCompanyId, match.partnerId] },
  );

  return NextResponse.json({
    data: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt },
  });
}

async function fetchMatchInTenant(id: string, tenantId: string) {
  const row = await queryOne<{
    id: string;
    briefId: string;
    partnerId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    briefTitle: string;
    briefCompanyId: string;
  }>(
    `SELECT m."id", m."briefId", m."partnerId", m."status",
            m."createdAt", m."updatedAt",
            b."title" AS "briefTitle", b."companyId" AS "briefCompanyId"
     FROM "Match" m JOIN "ProjectBrief" b ON b."id" = m."briefId"
     WHERE m."id" = $1 AND (m."partnerId" = $2 OR b."companyId" = $2)`,
    [id, tenantId],
  );
  if (!row) return null;
  return {
    id: row.id,
    briefId: row.briefId,
    partnerId: row.partnerId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    brief: { id: row.briefId, title: row.briefTitle, companyId: row.briefCompanyId },
  };
}
