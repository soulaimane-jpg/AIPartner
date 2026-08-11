/**
 * Public API — Partner directory (read-only, no API key required).
 *
 * Same data the public `/partners` page renders; this endpoint exists
 * so partners can sync the directory into their CRM and so we can
 * dogfood the directory from our own marketing surfaces.
 *
 * Anonymous access: this is *the* one read endpoint we deliberately
 * leave unauthenticated. Output is the same redacted shape as the
 * marketing surface; no PII surface area to protect.
 *
 * Caching: 5-minute browser cache + 60-second CDN revalidate. The
 * directory updates infrequently; partners signing up doesn't need
 * to invalidate the response in real time.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listPublicPartners } from "@/lib/public-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = await listPublicPartners({
    q: url.searchParams.get("q") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
    industry: url.searchParams.get("industry") ?? undefined,
    specialization: url.searchParams.get("specialization") ?? undefined,
    tier: url.searchParams.get("tier") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined,
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
