/**
 * Notification digest cron endpoint.
 *
 * Triggered by Cloud Scheduler (`scripts/setup-cron.sh`) weekly on
 * Mondays at 07:00 UTC. The worker itself decides who is actually due
 * (see `runDigest` in `@/lib/jobs/digest`); calling this route more
 * often than needed is safe.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` only — see
 * `@/lib/cron-auth` for why the query-parameter form was removed.
 *
 * Returns a small JSON status payload — never PII.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { withHeartbeat } from "@/lib/cron-heartbeat";
import { runDigest } from "@/lib/jobs/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await withHeartbeat("digest", () => runDigest());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.digest] worker failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "internal",
      },
      { status: 500 },
    );
  }
}
