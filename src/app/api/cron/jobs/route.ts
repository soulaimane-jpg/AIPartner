/**
 * Background job runner cron.
 *
 * Driven by Cloud Scheduler every 10 minutes
 * (`scripts/setup-cron.sh`). Pops up to 25 due `JobRun` rows and
 * routes them through `JOB_HANDLERS`.
 *
 * Same auth model as the other cron routes — `Bearer ${CRON_SECRET}`
 * header only, or localhost in dev when no secret is set.
 *
 * Returns a small JSON payload with run counts; never PII.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { withHeartbeat } from "@/lib/cron-heartbeat";
import { JOB_HANDLERS, runDueJobs } from "@/lib/jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await withHeartbeat("jobs", () => runDueJobs({ handlers: JOB_HANDLERS }));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.jobs] runner failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "internal",
      },
      { status: 500 },
    );
  }
}
