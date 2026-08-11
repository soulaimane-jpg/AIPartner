"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptLegalDocumentsAction } from "@/lib/actions/legal";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface PendingDoc {
  id: string;
  docType: string;
  version: number;
  title: string;
  body: string;
}

/**
 * M1 acceptance form: one scrollable panel per document, one
 * checkbox per document, single accept action for all.
 */
export function LegalAcceptForm({
  documents,
  defaultName,
  nextHref,
}: {
  documents: PendingDoc[];
  defaultName: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [name, setName] = React.useState(defaultName);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const allChecked = documents.every((d) => checked[d.id]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptLegalDocumentsAction({
        documentIds: documents.map((d) => d.id),
        acceptedName: name || undefined,
      });
      if (result.ok) {
        router.replace(nextHref);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  return (
    <div className="space-y-6">
      {documents.map((doc) => (
        <section
          key={doc.id}
          className="rounded-lg border border-border bg-background overflow-hidden"
        >
          <header className="px-5 py-3 border-b border-border flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold text-foreground">
              {doc.title}
            </h2>
            <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
              v{doc.version}
            </span>
          </header>
          <div className="max-h-64 overflow-y-auto px-5 py-4">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground/80">
              {doc.body}
            </pre>
          </div>
          <footer className="px-5 py-3 border-t border-border bg-secondary/30">
            <label className="flex items-center gap-2.5 cursor-pointer text-[13px] text-foreground">
              <Checkbox
                checked={checked[doc.id] ?? false}
                onCheckedChange={(v) =>
                  setChecked((prev) => ({ ...prev, [doc.id]: v === true }))
                }
              />
              I have read and accept the {doc.title} (version {doc.version})
            </label>
          </footer>
        </section>
      ))}

      <div className="rounded-lg border border-border bg-background px-5 py-4 space-y-3">
        <label className="block text-[12.5px] font-medium text-foreground">
          Full name (signature)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your full name"
          />
        </label>

        {error && (
          <p className="text-[13px] text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button
          onClick={submit}
          disabled={!allChecked || pending}
          className="w-full"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Accept and continue
        </Button>
        <p className="text-center text-[11.5px] text-muted-foreground">
          Your acceptance is recorded with a timestamp for each document
          version.
        </p>
      </div>
    </div>
  );
}
