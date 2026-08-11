/**
 * OAuth callback for the admin Google Calendar connect flow.
 *
 * Google redirects here with `code` + `state` query params. We:
 *   1. Verify the user is still a signed-in admin.
 *   2. Cross-check `state` against the HttpOnly cookie set in /connect.
 *   3. Exchange the code for tokens and store them encrypted.
 *   4. Redirect back to /admin/meetings with a status flag.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeAndStore } from "@/lib/google-calendar";
import { env } from "@/env";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/login", appBaseUrl()));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/meetings?error=${encodeURIComponent(error)}`, appBaseUrl()),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin/meetings?error=missing_code", appBaseUrl()),
    );
  }

  // Cross-check the state cookie set by /connect — CSRF defence.
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gcal_oauth_state="))
    ?.split("=")[1];
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/admin/meetings?error=bad_state", appBaseUrl()),
    );
  }

  try {
    await exchangeCodeAndStore(code, session.user.id);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[google/callback] token exchange failed", err);
    return NextResponse.redirect(
      new URL("/admin/meetings?error=exchange_failed", appBaseUrl()),
    );
  }

  const res = NextResponse.redirect(
    new URL("/admin/meetings?connected=1", appBaseUrl()),
  );
  // Burn the state cookie.
  res.cookies.set("gcal_oauth_state", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}
