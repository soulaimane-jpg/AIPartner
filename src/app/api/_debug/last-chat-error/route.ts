/**
 * TEMPORARY debug endpoint.
 *
 * Returns the most recent error captured from `/api/chat`. Auth-gated
 * so it can't be probed anonymously. Remove this file (and the
 * `recordChatError` import in `/api/chat/route.ts`, plus
 * `src/lib/_debug-last-error.ts`) once we've identified the chat bug.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readLastChatError } from "@/lib/_debug-last-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const last = readLastChatError();
  if (!last) {
    return NextResponse.json({
      ok: true,
      message:
        "No chat error captured yet. Send a message in the AI Builder, then refresh this URL.",
    });
  }
  return NextResponse.json({ ok: true, lastError: last });
}
