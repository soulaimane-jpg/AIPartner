/**
 * Partner-profile freshness cron.
 *
 * Driven weekly by Cloud Scheduler (`scripts/setup-cron.sh`). Finds partners
 * whose profiles haven't been re-checked in ~90 days and enqueues one
 * `partner.rescrape` job each.
 *
 * This route only *queues* work — the actual scraping and LLM extraction runs
 * through the background job runner (`/api/cron/jobs`). Two reasons:
 *
 *   1. Scraping N partners inline would blow past any sane HTTP timeout.
 *   2. The job queue already gives us retries with backoff and a DLQ, which
 *      matters because third-party pages fail transiently all the time.
 *
 * Same auth model as the other cron routes. Returns counts only, never PII.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { sweepDueRescrapes } from "@/lib/jobs/partner-rescrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    const host = req.headers.get("host") ?? "";
    return host.startsWith("localhost") || host.startsWith("127.0.0.1");
  }
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 },
    );
  }
  try {
    const result = await sweepDueRescrapes();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.partner-freshness] sweep failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "internal",
      },
      { status: 500 },
    );
  }
}
