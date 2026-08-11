/**
 * Background job runner cron.
 *
 * Triggered by Vercel Cron every minute (`* * * * *`). Pops up to 25
 * due `JobRun` rows and routes them through `JOB_HANDLERS`.
 *
 * Same auth model as the other cron routes — `Bearer ${CRON_SECRET}`
 * header, or localhost in dev when no secret is set.
 *
 * Returns a small JSON payload with run counts; never PII.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { JOB_HANDLERS, runDueJobs } from "@/lib/jobs/queue";

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
    const result = await runDueJobs({ handlers: JOB_HANDLERS });
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
