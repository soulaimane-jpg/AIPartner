/**
 * Single match attachment download / delete.
 *
 * GET streams the object through this handler — the bucket stays private.
 * DELETE removes the DB row first, then the GCS object.
 *
 * Auth: the caller must be the partner on the match or an admin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { queryOne, exec } from "@/lib/db";
import { openDownloadStream, deleteObject } from "@/lib/storage/gcs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ matchId: string; attachmentId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { matchId, attachmentId } = await params;

  const match = await queryOne<{ partnerId: string }>(
    `SELECT "partnerId" FROM "Match" WHERE "id" = $1`,
    [matchId],
  );
  if (!match) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const isPartner = match.partnerId === session.user.companyId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isPartner && !isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const row = await queryOne<{ storagePath: string; filename: string; mimeType: string }>(
    `SELECT "storagePath", "filename", "mimeType"
     FROM "MatchAttachment" WHERE "id" = $1 AND "matchId" = $2`,
    [attachmentId, matchId],
  );
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    const nodeStream = openDownloadStream(row.storagePath);
    nodeStream.on("error", (err) => {
      console.error("[match-attachments] stream error", row.storagePath, err);
      (nodeStream as unknown as Readable).destroy();
    });

    const body = Readable.toWeb(
      nodeStream as unknown as Readable,
    ) as unknown as ReadableStream;

    return new NextResponse(body, {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[match-attachments] download failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not download that file." },
      { status: 502 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { matchId, attachmentId } = await params;

  const match = await queryOne<{ partnerId: string }>(
    `SELECT "partnerId" FROM "Match" WHERE "id" = $1`,
    [matchId],
  );
  if (!match) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (match.partnerId !== session.user.companyId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const row = await queryOne<{ storagePath: string }>(
    `SELECT "storagePath" FROM "MatchAttachment" WHERE "id" = $1 AND "matchId" = $2`,
    [attachmentId, matchId],
  );
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await exec('DELETE FROM "MatchAttachment" WHERE "id" = $1', [attachmentId]);
  await deleteObject(row.storagePath);

  return NextResponse.json({ ok: true });
}
