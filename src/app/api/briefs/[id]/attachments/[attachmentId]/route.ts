/**
 * Single-attachment download / delete.
 *
 * GET streams the object straight through this handler. The bucket stays
 * private and no shareable URL is ever minted, so access is re-checked on every
 * single request rather than trusting a signed link that outlives revocation.
 *
 * Every query is filtered by BOTH the attachment id and the brief id from the
 * path, so a valid id from another brief can't be read through this route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { queryOne, exec } from "@/lib/db";
import { getBriefCapabilities } from "@/lib/workspace-access";
import { openDownloadStream, deleteObject } from "@/lib/storage/gcs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id: briefId, attachmentId } = await params;

  const caps = await getBriefCapabilities(
    {
      userId: session.user.id,
      companyId: session.user.companyId,
      platformRole: session.user.role,
    },
    briefId,
  );
  if (!caps.canOpenBrief) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const row = await queryOne<{
    storagePath: string;
    filename: string;
    mimeType: string;
  }>(
    `SELECT "storagePath", "filename", "mimeType"
       FROM "BriefAttachment" WHERE "id" = $1 AND "briefId" = $2`,
    [attachmentId, briefId],
  );
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    const nodeStream = openDownloadStream(row.storagePath);
    // GCS reports a missing object or a permission problem asynchronously,
    // after the response has already started. Log it and destroy the stream so
    // the connection closes instead of hanging the client forever.
    nodeStream.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[attachments] stream error", row.storagePath, err);
      (nodeStream as unknown as Readable).destroy();
    });

    const body = Readable.toWeb(
      nodeStream as unknown as Readable,
    ) as unknown as ReadableStream;

    return new NextResponse(body, {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        // `attachment` so a malicious upload can never render in our origin.
        "Content-Disposition": `attachment; filename="${row.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[attachments] download failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not download that file." },
      { status: 502 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id: briefId, attachmentId } = await params;

  const caps = await getBriefCapabilities(
    {
      userId: session.user.id,
      companyId: session.user.companyId,
      platformRole: session.user.role,
    },
    briefId,
  );
  if (!caps.canEditBrief) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const row = await queryOne<{ storagePath: string }>(
    'SELECT "storagePath" FROM "BriefAttachment" WHERE "id" = $1 AND "briefId" = $2',
    [attachmentId, briefId],
  );
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Row first: it's what the AI context and the UI read from. A surviving
  // bucket object is invisible and gets swept by the lifecycle rule, whereas a
  // surviving row would keep feeding deleted content to the model.
  await exec('DELETE FROM "BriefAttachment" WHERE "id" = $1', [attachmentId]);
  await deleteObject(row.storagePath);

  return NextResponse.json({ ok: true });
}
