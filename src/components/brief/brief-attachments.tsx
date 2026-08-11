"use client";

/**
 * Attachment strip for the brief builder composer.
 *
 * Uploads go straight to the route handler as multipart rather than through a
 * Server Action, because Server Actions here are capped at 2 MB.
 *
 * Files are uploaded one at a time on purpose: extraction happens inline on the
 * server, so firing ten parallel PDF parses at one container is a reliable way
 * to exhaust memory. Sequential keeps peak usage to a single document.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Paperclip,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  X,
  Loader2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCEPT_ATTR =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.gif";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractionStatus: "pending" | "ready" | "failed" | "unsupported";
  extractionError: string | null;
  extractedChars?: number;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function BriefAttachments({
  briefId,
  canEdit,
  onChanged,
}: {
  briefId: string;
  canEdit: boolean;
  /** Called after a successful upload/delete so the parent can refresh. */
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/briefs/${briefId}/attachments`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) setItems(data.attachments ?? []);
    } catch {
      // Non-fatal: the strip just stays empty.
    }
  }, [briefId]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadOne = useCallback(
    async (file: File): Promise<boolean> => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `“${file.name}” is ${formatBytes(file.size)} — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        );
        return false;
      }
      setBusy(file.name);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/briefs/${briefId}/attachments`, {
          method: "POST",
          body: fd,
        });

        // An expired session is bounced to the sign-in page by middleware, so
        // we get HTML back rather than our JSON error shape. Say so plainly
        // instead of showing a generic "upload failed".
        if (!res.headers.get("content-type")?.includes("application/json")) {
          setError("Your session expired. Refresh the page and sign in again.");
          return false;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Could not upload “${file.name}”.`);
          return false;
        }
        setItems((prev) => [data.attachment, ...prev]);
        return true;
      } catch {
        setError(`Could not upload “${file.name}”. Check your connection.`);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [briefId],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      let any = false;
      for (const file of Array.from(files)) {
        // Sequential — see the note at the top of this file.
        if (await uploadOne(file)) any = true;
      }
      if (any) onChanged?.();
    },
    [uploadOne, onChanged],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        const res = await fetch(`/api/briefs/${briefId}/attachments/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setItems((prev) => prev.filter((a) => a.id !== id));
          onChanged?.();
        } else {
          setError("Could not remove that file.");
        }
      } finally {
        setBusy(null);
      }
    },
    [briefId, onChanged],
  );

  if (!canEdit && items.length === 0) return null;

  return (
    <div
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "mb-2 rounded-lg transition-colors",
        dragging && "ring-2 ring-primary/35 bg-primary/5",
      )}
    >
      {items.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {items.map((a) => {
            const problem =
              a.extractionStatus === "failed" || a.extractionStatus === "unsupported";
            return (
              <li
                key={a.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px]",
                  problem
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-border bg-secondary text-foreground",
                )}
                title={
                  problem
                    ? (a.extractionError ??
                      "The assistant can't read this file's contents.")
                    : a.mimeType.startsWith("image/")
                      ? "Attached. Describe it in chat if the detail matters."
                      : "The assistant can read this file."
                }
              >
                {problem ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <FileIcon mimeType={a.mimeType} />
                )}
                <span className="max-w-[13rem] truncate">{a.filename}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatBytes(a.sizeBytes)}
                </span>
                <a
                  href={`/api/briefs/${briefId}/attachments/${a.id}`}
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Download ${a.filename}`}
                >
                  <Download className="h-3 w-3" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void remove(a.id)}
                    disabled={busy === a.id}
                    className="rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                    aria-label={`Remove ${a.filename}`}
                  >
                    {busy === a.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-danger/20 bg-danger/5 px-2.5 py-1.5 text-[11.5px] text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading {busy}…
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" />
                Attach files
                <span className="text-muted-foreground/70">
                  PDF, Word, Excel, CSV, text or images
                </span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
