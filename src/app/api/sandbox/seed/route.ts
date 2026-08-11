/**
 * `POST /api/sandbox/seed` — boot a demo session.
 *
 * Anonymous: anyone can hit it from `/sandbox`. We rate-limit by IP
 * (4/min) to keep the demo cheap. The response sets an HttpOnly
 * cookie carrying the session token; the `/sandbox/[id]` UI reads
 * the token server-side on every request and renders the synthetic
 * brief.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  SANDBOX_COOKIE,
  SANDBOX_TTL_MS,
  bootSandbox,
  hashIpForSandbox,
} from "@/lib/sandbox";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipHash = hashIpForSandbox(ip);

  const rl = await checkRateLimit({
    key: `sandbox:boot:${ipHash}`,
    limit: 4,
    windowSec: 60,
  });
  if (rl.limited) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await bootSandbox({
    ipHash,
    userAgent: req.headers.get("user-agent") ?? null,
  });

  const res = NextResponse.json(
    {
      ok: true,
      session: {
        briefId: session.briefId,
        expiresAt: session.expiresAt.toISOString(),
      },
    },
    { status: 201 },
  );
  res.cookies.set({
    name: SANDBOX_COOKIE,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SANDBOX_TTL_MS / 1000),
  });
  return res;
}
