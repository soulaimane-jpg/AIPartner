/**
 * Timer-engine sweep cron — plan-A §7.
 *
 * Trigger every 1–5 minutes (Cloud Scheduler / Vercel Cron):
 *   - fires deadline reminders at the configured offsets
 *   - expires overdue timers and runs their expiry actions
 *     (state transitions + notifications, as the `system` actor)
 *
 * Same auth model as the other cron routes — `Bearer ${CRON_SECRET}`
 * header, or localhost in dev when no secret is set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { sweepTimers } from "@/lib/timers";

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
    const result = await sweepTimers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.timers] sweep failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "internal" },
      { status: 500 },
    );
  }
}
