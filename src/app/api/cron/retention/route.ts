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
import { isCronAuthorised } from "@/lib/cron-auth";
import { withHeartbeat } from "@/lib/cron-heartbeat";
import { runRetention, seedRetentionPolicies } from "@/lib/jobs/retention";
import { sweepDsrRequests } from "@/lib/jobs/dsr";
import { captureError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await withHeartbeat("retention", async () => {
      await seedRetentionPolicies();
      const purged = await runRetention();
      // Catch-up for data-subject requests: fulfilment is normally
      // enqueued at request time, but a lost enqueue must not leave a
      // statutory 30-day clock running with nothing on the other end.
      const dsr = await sweepDsrRequests();
      return { ...purged, dsr };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    captureError(err, { scope: "cron", job: "retention" });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "internal",
      },
      { status: 500 },
    );
  }
}
