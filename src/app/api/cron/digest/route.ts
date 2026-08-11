/**
 * Notification digest cron endpoint.
 *
 * Triggered by Vercel Cron (or any scheduler) on an hourly cadence —
 * `vercel.json` configures `0 * * * *`. The worker itself decides who
 * is actually due (see `runDigest` in `@/lib/jobs/digest`); calling
 * this route more often than needed is safe.
 *
 * Auth: we accept any of:
 *   - Vercel Cron's `Authorization: Bearer <CRON_SECRET>` header,
 *   - a `?secret=<CRON_SECRET>` query (handy for local curl tests),
 *   - or, when `CRON_SECRET` is unset, allow only from localhost.
 *
 * Returns a small JSON status payload — never PII.
 */

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { runDigest } from "@/lib/jobs/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    // No secret configured — only allow when the request comes from
    // localhost (developer triggering manually).
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
    const result = await runDigest();
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
