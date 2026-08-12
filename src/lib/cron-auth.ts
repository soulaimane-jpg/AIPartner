import "server-only";

import type { NextRequest } from "next/server";
import { env } from "@/env";

/**
 * Shared authentication for `/api/cron/*`.
 *
 * Header-only by design: a `?secret=` query parameter lands in access
 * logs, proxy logs, and `Referer` headers, so accepting one turns every
 * log store into a credential store. Cloud Scheduler sends the bearer
 * header (`scripts/setup-cron.sh`), so nothing needs the query form.
 *
 * When `CRON_SECRET` is unset we allow localhost only, so a developer
 * can trigger a job by hand without the jobs silently running open in
 * a deployed environment.
 */
export function isCronAuthorised(req: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    const host = req.headers.get("host") ?? "";
    return host.startsWith("localhost") || host.startsWith("127.0.0.1");
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
