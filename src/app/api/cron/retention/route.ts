/**
 * Retention purge cron endpoint (GDPR art. 5(1)(e), storage limitation).
 *
 * Driven nightly by Cloud Scheduler (`scripts/setup-cron.sh`), which presents
 * `CRON_SECRET` as a bearer token. Returns a small JSON payload with per-model
 * deletion counts — never PII.
 *
 * The run seeds `RetentionPolicy` first. `seedRetentionPolicies()` is
 * idempotent (`ON CONFLICT DO NOTHING`, so admin overrides survive), and
 * seeding here means the job can't silently purge nothing because the table
 * was never populated — which is exactly what had happened in production.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { runRetention, seedRetentionPolicies } from "@/lib/jobs/retention";

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
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    await seedRetentionPolicies();
    const result = await runRetention();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.retention] worker failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "internal",
      },
      { status: 500 },
    );
  }
}
