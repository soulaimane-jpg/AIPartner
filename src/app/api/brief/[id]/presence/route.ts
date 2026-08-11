/**
 * Read endpoint for `PresenceAvatars` polling.
 *
 * GET `/api/brief/[id]/presence` → `{ users: PresenceUser[] }`
 *
 * We re-check brief access on every poll — same gates as the comment
 * action: brief owner, active collaborator, or admin. Anything else
 * gets `403` (NOT 404, because lying about presence existence to
 * unrelated users is fine).
 *
 * Output is intentionally minimal — id + display name + activity.
 * No emails for non-owners (privacy).
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { listPresenceForBrief } from "@/lib/actions/presence";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ users: [] }, { status: 401 });
  }
  const { id } = await params;

  // Authorisation: owner / active collaborator / admin
  const brief = await queryOne<{ ownerId: string }>(
    'SELECT "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
    [id],
  );
  if (!brief) {
    return NextResponse.json({ users: [] }, { status: 404 });
  }
  const isOwner = brief.ownerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    const seat = await queryOne<{ id: string }>(
      `SELECT "id" FROM "BriefCollaborator"
       WHERE "briefId" = $1
         AND ("userId" = $2 OR "email" = $3)
         AND "status" <> 'REMOVED'
       LIMIT 1`,
      [id, session.user.id, (session.user.email ?? "").toLowerCase()],
    );
    if (!seat) return NextResponse.json({ users: [] }, { status: 403 });
  }

  const rows = await listPresenceForBrief(id, { windowSec: 30 });
  const isPrivileged = isOwner || isAdmin;
  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: isPrivileged ? r.user.email : null,
      activity: r.activity,
    })),
  });
}
