/**
 * Brief attachment upload / list endpoint.
 *
 * A route handler rather than a Server Action because Server Actions are capped
 * by `experimental.serverActions.bodySizeLimit` (2 MB here) — far too small for
 * the decks and spreadsheets customers actually attach.
 *
 * Tenant safety: every request resolves `getBriefCapabilities` first, and the
 * stored object path is prefixed with the brief's own `companyId`. Uploading
 * requires edit rights; listing only requires read.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne, insertRow } from "@/lib/db";
import type { BriefAttachmentRow } from "@/lib/db/rows";
import { getBriefCapabilities } from "@/lib/workspace-access";
import {
  buildStoragePath,
  uploadBuffer,
  isStorageConfigured,
  StorageNotConfiguredError,
} from "@/lib/storage/gcs";
import {
  classifyUpload,
  extractText,
  MAX_UPLOAD_BYTES,
  verifySignature,
} from "@/lib/attachments/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Columns safe to return to the client — never the full extracted text. */
const LIST_COLUMNS = `"id", "filename", "mimeType", "sizeBytes",
  "extractionStatus", "extractionError", "createdAt",
  (CASE WHEN "extractedText" IS NULL THEN 0
        ELSE length("extractedText") END) AS "extractedChars"`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id: briefId } = await params;

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

  const rows = await query(
    `SELECT ${LIST_COLUMNS} FROM "BriefAttachment"
      WHERE "briefId" = $1 ORDER BY "createdAt" DESC`,
    [briefId],
  );
  return NextResponse.json({ ok: true, attachments: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id: briefId } = await params;

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
  if (!caps.canEditBrief) {
    return NextResponse.json(
      { ok: false, error: "You need edit access to attach files to this brief." },
      { status: 403 },
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "File uploads aren't configured on this environment yet. Ask an administrator to set GCS_BUCKET.",
      },
      { status: 503 },
    );
  }

  // The brief's own company owns the object path — never the session's, so a
  // cross-company session can't write into another tenant's prefix.
  const brief = await queryOne<{ companyId: string }>(
    'SELECT "companyId" FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!brief) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file was included in the request." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "That file is empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const kind = classifyUpload(file.type, file.name);
  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported file type. Attach a PDF, Word, Excel, CSV, text, Markdown or image file.",
      },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The declared MIME type and the extension are both client-controlled,
  // so verify the actual bytes before we hand the file to a parser.
  const signature = verifySignature(kind, buffer);
  if (!signature.ok) {
    return NextResponse.json(
      { ok: false, error: `“${file.name}”: ${signature.reason}` },
      { status: 415 },
    );
  }

  const storagePath = buildStoragePath({
    companyId: brief.companyId,
    briefId,
    filename: file.name,
  });

  try {
    await uploadBuffer({
      storagePath,
      buffer,
      mimeType: file.type || "application/octet-stream",
      filename: file.name,
    });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    // eslint-disable-next-line no-console
    console.error("[attachments] upload failed", err);
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }

  // Extract synchronously: the file is already in memory, and the builder wants
  // to reference it on the very next chat turn. A failure here is recorded on
  // the row rather than failing the upload — the file is safely stored.
  const extraction = await extractText(kind, buffer);

  const row = await insertRow<BriefAttachmentRow>("BriefAttachment", {
    briefId,
    companyId: brief.companyId,
    uploadedById: session.user.id,
    filename: file.name.slice(0, 260),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storagePath,
    extractedText: extraction.text,
    extractionStatus: extraction.status,
    extractionError: extraction.error,
  });

  return NextResponse.json({
    ok: true,
    attachment: {
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      extractionStatus: row.extractionStatus,
      extractionError: row.extractionError,
      createdAt: row.createdAt,
      extractedChars: extraction.text?.length ?? 0,
    },
  });
}
