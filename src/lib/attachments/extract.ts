import "server-only";

/**
 * Turn an uploaded file into plain text the AI builder can reason over.
 *
 * Design notes:
 *  - Parsers are imported lazily inside each branch. They're heavy (pdf.js,
 *    zip readers) and most requests never touch them, so a top-level import
 *    would tax every cold start.
 *  - Images are deliberately NOT parsed here. Claude reads them natively as
 *    vision blocks, which is far better than bolting on OCR.
 *  - Everything is capped by `MAX_EXTRACTED_CHARS`. A 200-page PDF would
 *    otherwise blow the model's context window and push out the actual
 *    conversation.
 */

import type { AttachmentExtractionStatus } from "@/lib/db/rows";

/** Upload ceiling. Large enough for real SoWs and architecture decks. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Per-file cap on text handed to the model. ~40k chars ≈ 10k tokens, so a
 * handful of documents still leaves room for the conversation itself.
 */
export const MAX_EXTRACTED_CHARS = 40_000;

/** MIME types we accept, mapped to how we handle them. */
export const ACCEPTED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
  "text/csv": "text",
  "text/plain": "text",
  "text/markdown": "text",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
} as const;

export type AttachmentKind =
  (typeof ACCEPTED_MIME_TYPES)[keyof typeof ACCEPTED_MIME_TYPES];

/**
 * Resolve a file to its handler.
 *
 * Browsers are inconsistent about MIME types for `.md`/`.csv` (often
 * `application/octet-stream` or empty), so we fall back to the extension
 * rather than rejecting a file the user legitimately picked.
 */
export function classifyUpload(
  mimeType: string,
  filename: string,
): AttachmentKind | null {
  const direct = ACCEPTED_MIME_TYPES[mimeType as keyof typeof ACCEPTED_MIME_TYPES];
  if (direct) return direct;

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return "pdf";
    case "docx":
    case "doc":
      return "docx";
    case "xlsx":
    case "xls":
      return "xlsx";
    case "csv":
    case "txt":
    case "md":
    case "markdown":
      return "text";
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return "image";
    default:
      return null;
  }
}

export interface ExtractionResult {
  status: AttachmentExtractionStatus;
  text: string | null;
  error: string | null;
}

function truncate(text: string): string {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (normalised.length <= MAX_EXTRACTED_CHARS) return normalised;
  return (
    normalised.slice(0, MAX_EXTRACTED_CHARS) +
    `\n\n…[truncated — file continues beyond ${MAX_EXTRACTED_CHARS.toLocaleString()} characters]`
  );
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // `unpdf` bundles a serverless-friendly pdf.js build — no native deps and no
  // filesystem access, which matters inside the Cloud Run container.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  // NOTE: `exceljs` is used read-only. We never call its workbook *writer*,
  // which is the only path that touches `archiver` (the source of its npm
  // advisory). Kept isolated here so it's trivial to swap out.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // `row.values` is 1-indexed with a leading hole.
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          // Formula/rich-text/hyperlink cells expose the rendered value here.
          const o = v as { result?: unknown; text?: unknown; hyperlink?: unknown };
          return String(o.result ?? o.text ?? o.hyperlink ?? "");
        }
        return String(v);
      });
      // Tab-separated keeps the grid legible to the model without the noise
      // of a full markdown table.
      if (cells.some((c) => c !== "")) rows.push(cells.join("\t"));
    });
    if (rows.length) parts.push(`## Sheet: ${sheet.name}\n${rows.join("\n")}`);
  });
  return parts.join("\n\n");
}

/** Extract text for a buffer already classified by `classifyUpload`. */
export async function extractText(
  kind: AttachmentKind,
  buffer: Buffer,
): Promise<ExtractionResult> {
  try {
    let text: string;
    switch (kind) {
      case "pdf":
        text = await extractPdf(buffer);
        break;
      case "docx":
        text = await extractDocx(buffer);
        break;
      case "xlsx":
        text = await extractXlsx(buffer);
        break;
      case "text":
        text = buffer.toString("utf8");
        break;
      case "image":
        // Sent to the model as a vision block instead of text.
        return { status: "ready", text: null, error: null };
      default:
        return { status: "unsupported", text: null, error: null };
    }

    const trimmed = truncate(text);
    if (!trimmed) {
      // A scanned PDF or an empty sheet. Not a failure — the file is stored and
      // still downloadable, we just can't feed it to the model as text.
      return {
        status: "unsupported",
        text: null,
        error: "No machine-readable text found (the file may be a scan).",
      };
    }
    return { status: "ready", text: trimmed, error: null };
  } catch (err) {
    return {
      status: "failed",
      text: null,
      error: err instanceof Error ? err.message.slice(0, 300) : "extraction failed",
    };
  }
}
