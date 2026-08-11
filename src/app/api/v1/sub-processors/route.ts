/**
 * Public API — Sub-processor list.
 *
 *   GET /api/v1/sub-processors → flat list of active sub-processors
 *
 * Anonymous. This is the machine-readable counterpart of the table on
 * `/trust`. Procurement teams + automated compliance bots subscribe
 * to it; we set a long browser cache and a short CDN revalidate so
 * a withdrawal propagates in ≤ 60s.
 */

import { NextResponse } from "next/server";
import { listSubProcessors } from "@/lib/sub-processors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listSubProcessors();
  return NextResponse.json(
    {
      data: rows,
      retrievedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
