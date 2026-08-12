/**
 * Timer-engine sweep cron — plan-A §7.
 *
 * Driven by Cloud Scheduler every 15 minutes
 * (`scripts/setup-cron.sh`):
 *   - fires deadline reminders at the configured offsets
 *   - expires overdue timers and runs their expiry actions
 *     (state transitions + notifications, as the `system` actor)
 *
 * Same auth model as the other cron routes — `Bearer ${CRON_SECRET}`
 * header only, or localhost in dev when no secret is set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";
import { withHeartbeat, alertOnUnhealthyCrons } from "@/lib/cron-heartbeat";
import { sweepTimers } from "@/lib/timers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorised(req)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await withHeartbeat("timers", () => sweepTimers());
    // The most frequent job is the natural watchdog for the others:
    // a scheduler that has stopped can't report its own absence.
    const alerted = await alertOnUnhealthyCrons();
    return NextResponse.json({ ok: true, ...result, alerted });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron.timers] sweep failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "internal" },
      { status: 500 },
    );
  }
}
