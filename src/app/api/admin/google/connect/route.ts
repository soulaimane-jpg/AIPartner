/**
 * Kicks off the Google Calendar OAuth flow for the signed-in admin.
 *
 * Generates a CSRF state token, sets it as an HttpOnly cookie, and
 * redirects the browser to Google's consent screen. The callback
 * route (`/api/admin/google/callback`) verifies the cookie matches the
 * `state` parameter Google echoes back.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import {
  buildAuthUrl,
  isCalendarConfigured,
} from "@/lib/google-calendar";
import { env } from "@/env";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export async function GET(_req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/login", appBaseUrl()));
  }

  if (!isCalendarConfigured()) {
    return NextResponse.redirect(
      new URL("/admin/meetings?error=not_configured", appBaseUrl()),
    );
  }

  const state = randomBytes(24).toString("base64url");
  const authUrl = buildAuthUrl(state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes — plenty of time for the consent screen
    path: "/",
  });
  return res;
}
