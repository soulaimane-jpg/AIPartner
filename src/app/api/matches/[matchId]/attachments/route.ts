/**
 * Match attachment upload / list endpoint.
 *
 * Partners upload questionnaire files and proposal documents (PDF, DOC,
 * XLSX, images) against a match. The binary lives in GCS under
 * `proposals/<partnerId>/<matchId>/<uuid>-<filename>`.
 *
 * Auth: the caller must belong to the partner company on the match, and
 * the match must be in an accepted state (PARTNER_ACCEPTED or later).
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne, insertRow } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  uploadBuffer,
  isStorageConfigured,
  StorageNotConfiguredError,
} from "@/lib/storage/gcs";
import {
  classifyUpload,
  verifySignature,
  MAX_UPLOAD_BYTES,
} from "@/lib/attachments/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS = new Set(["questionnaire", "proposal"]);

function safeObjectName(filename: string): string {
  const cleaned = filename
    .replace(/[/\\]/g, "-")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "upload";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { matchId } = await params;

  const match = await queryOne<{
    partnerId: string;
    briefId: string;
    status: string;
  }>(
    `SELECT "partnerId", "briefId", "status" FROM "Match" WHERE "id" = $1`,
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

  const kind = _req.nextUrl.searchParams.get("kind");
  const kindFilter = kind && VALID_KINDS.has(kind) ? `AND "kind" = '${kind}'` : "";

  const rows = await query(
    `SELECT "id", "kind", "filename", "mimeType", "sizeBytes", "createdAt"
     FROM "MatchAttachment"
     WHERE "matchId" = $1 ${kindFilter}
     ORDER BY "createdAt" DESC`,
    [matchId],
  );
  return NextResponse.json({ ok: true, attachments: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { matchId } = await params;

  const match = await queryOne<{
    partnerId: string;
    briefId: string;
    status: string;
  }>(
    `SELECT "partnerId", "briefId", "status" FROM "Match" WHERE "id" = $1`,
    [matchId],
  );
  if (!match) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (match.partnerId !== session.user.companyId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const acceptedStates = [
    "PARTNER_ACCEPTED",
    "EXTENSION_REQUESTED",
    "PROPOSAL_SUBMITTED",
    "QC_PASSED",
  ];
  if (!acceptedStates.includes(match.status)) {
    return NextResponse.json(
      { ok: false, error: "Accept the lead before uploading files." },
      { status: 409 },
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { ok: false, error: "File uploads aren't configured on this environment." },
      { status: 503 },
    );
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
    return NextResponse.json({ ok: false, error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const kind = (form.get("kind") as string) || "proposal";
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "Invalid file kind. Use 'questionnaire' or 'proposal'." },
      { status: 400 },
    );
  }

  const classified = classifyUpload(file.type, file.name);
  if (!classified) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported file type. Upload a PDF, Word, Excel, CSV, text, Markdown or image file.",
      },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // MIME type and extension are both client-controlled; verify the bytes.
  const signature = verifySignature(classified, buffer);
  if (!signature.ok) {
    return NextResponse.json(
      { ok: false, error: `“${file.name}”: ${signature.reason}` },
      { status: 415 },
    );
  }

  const storagePath = `proposals/${match.partnerId}/${matchId}/${randomUUID()}-${safeObjectName(file.name)}`;

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
    console.error("[match-attachments] upload failed", err);
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again." },
      { status: 502 },
    );
  }

  const row = await insertRow<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
  }>("MatchAttachment", {
    matchId,
    briefId: match.briefId,
    partnerId: match.partnerId,
    uploadedById: session.user.id,
    kind,
    filename: file.name.slice(0, 260),
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storagePath,
  });

  return NextResponse.json({
    ok: true,
    attachment: {
      id: row.id,
      kind: row.kind,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    },
  });
}
