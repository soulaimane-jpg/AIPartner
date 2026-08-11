/**
 * Disconnect Google Calendar — wipes the stored token row for the
 * signed-in admin. Future scheduling attempts will prompt re-consent.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "@/lib/db";
import { env } from "@/env";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/login", appBaseUrl()));
  }
  await exec('DELETE FROM "GoogleCalendarToken" WHERE "userId" = $1', [
    session.user.id,
  ]);
  return NextResponse.redirect(
    new URL("/admin/meetings?disconnected=1", appBaseUrl()),
  );
}
