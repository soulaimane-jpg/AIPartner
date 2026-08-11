"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishLegalDocumentAction } from "@/lib/actions/legal";
import { mapErrorToToast } from "@/lib/schemas/errors";

/**
 * Inline editor for one legal doc type. Collapsed by default —
 * expanding shows the current text pre-filled for editing; publishing
 * creates the next version.
 */
export function PublishLegalForm({
  docType,
  currentTitle,
  currentBody,
}: {
  docType: string;
  currentTitle: string;
  currentBody: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(currentTitle);
  const [body, setBody] = React.useState(currentBody);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [published, setPublished] = React.useState<number | null>(null);

  const publish = () => {
    setError(null);
    startTransition(async () => {
      const result = await publishLegalDocumentAction({
        docType: docType as never,
        title,
        body,
      });
      if (result.ok) {
        setPublished(result.data.version);
        setOpen(false);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  return (
    <div className="px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {open ? "Collapse" : "Edit & publish new version"}
      </button>

      {published !== null && !open && (
        <p className="mt-2 text-[12.5px] text-emerald-700">
          Published v{published}. The gate re-triggers for all users.
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-ring"
            placeholder="Document title"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-ring"
            placeholder="Full legal text"
          />
          {error && (
            <p className="text-[13px] text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={publish} disabled={pending || body.length < 10}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Publish new version
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
