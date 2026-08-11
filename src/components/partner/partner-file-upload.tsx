"use client";

/**
 * Partner file upload strip for questionnaires and proposal documents.
 *
 * Uploads go to the route handler as multipart (not Server Actions) to
 * bypass the 2 MB body limit. Files are stored in GCS under
 * `proposals/<partnerId>/<matchId>/`.
 *
 * Supports PDF, Word, Excel, CSV, text, and image files up to 15 MB.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Paperclip,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  X,
  Loader2,
  Download,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const PARTNER_ACCEPT_ATTR =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.gif";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

type Attachment = {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
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

export function PartnerFileUpload({
  matchId,
  kind,
  title,
  description,
  canUpload,
}: {
  matchId: string;
  /** "questionnaire" | "proposal" */
  kind: "questionnaire" | "proposal";
  title: string;
  description: string;
  canUpload: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/attachments?kind=${kind}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) setItems(data.attachments ?? []);
    } catch {
      // Non-fatal
    }
  }, [matchId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadOne = useCallback(
    async (file: File): Promise<boolean> => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `"${file.name}" is ${formatBytes(file.size)} — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        );
        return false;
      }
      setBusy(file.name);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const res = await fetch(`/api/matches/${matchId}/attachments`, {
          method: "POST",
          body: fd,
        });

        if (!res.headers.get("content-type")?.includes("application/json")) {
          setError("Your session expired. Refresh the page and sign in again.");
          return false;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Could not upload "${file.name}".`);
          return false;
        }
        setItems((prev) => [data.attachment, ...prev]);
        return true;
      } catch {
        setError(`Could not upload "${file.name}". Check your connection.`);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [matchId, kind],
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      for (const file of Array.from(files)) {
        await uploadOne(file);
      }
    },
    [uploadOne],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        const res = await fetch(`/api/matches/${matchId}/attachments/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setItems((prev) => prev.filter((a) => a.id !== id));
        } else {
          setError("Could not remove that file.");
        }
      } finally {
        setBusy(null);
      }
    },
    [matchId],
  );

  return (
    <div
      onDragOver={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-line bg-card p-5 space-y-3 transition-colors",
        dragging && "ring-2 ring-blue-500/40 bg-blue-50/50",
      )}
    >
      <div className="flex items-center gap-2">
        {kind === "questionnaire" ? (
          <FileText className="h-4 w-4 text-primary" />
        ) : (
          <Upload className="h-4 w-4 text-primary" />
        )}
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-[12.5px] text-muted-foreground">{description}</p>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[12px]"
            >
              <FileIcon mimeType={a.mimeType} />
              <span className="max-w-[14rem] truncate font-medium">{a.filename}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatBytes(a.sizeBytes)}
              </span>
              <a
                href={`/api/matches/${matchId}/attachments/${a.id}`}
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-black/5 focus:opacity-100 group-hover:opacity-100"
                aria-label={`Download ${a.filename}`}
              >
                <Download className="h-3 w-3" />
              </a>
              {canUpload && (
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
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-danger/20 bg-danger/5 px-2.5 py-1.5 text-[11.5px] text-danger">
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

      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={PARTNER_ACCEPT_ATTR}
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
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-primary border border-line bg-background hover:bg-surface-1 transition-colors disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading {busy}…
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" />
                Upload {kind === "questionnaire" ? "questionnaire" : "proposal"} files
                <span className="text-muted-foreground/70">
                  PDF, Word, Excel, images
                </span>
              </>
            )}
          </button>
        </>
      )}

      {!canUpload && items.length === 0 && (
        <p className="text-[12px] text-muted-foreground italic">
          No files uploaded yet.
        </p>
      )}
    </div>
  );
}
