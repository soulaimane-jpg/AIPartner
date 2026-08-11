"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateBriefSectionAction,
  confirmCallBriefAction,
} from "@/lib/actions/brief-call";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface SectionRow {
  key: string;
  label: string;
  hint: string;
  mandatory: boolean;
  content: string;
  aiGenerated: boolean;
}

export function ReviewCallBrief({
  briefId,
  sections,
  alreadySubmitted,
}: {
  briefId: string;
  sections: SectionRow[];
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(sections);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [confirming, startConfirm] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const saveSection = async (key: string) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    setSavingKey(key);
    setError(null);
    const result = await updateBriefSectionAction({
      briefId,
      key,
      content: row.content,
    });
    setSavingKey(null);
    if (result.ok) {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, aiGenerated: false } : r)),
      );
    } else {
      setError(mapErrorToToast(result.error));
    }
  };

  const confirm = () => {
    setError(null);
    startConfirm(async () => {
      const result = await confirmCallBriefAction({ briefId });
      if (result.ok) {
        router.push(`/briefs/${briefId}/preview`);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  const missingMandatory = rows.filter(
    (r) => r.mandatory && !r.content.trim(),
  );

  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <section
          key={row.key}
          className="rounded-2xl border border-border bg-card shadow-elev-1 overflow-hidden"
        >
          <header className="px-5 py-3 border-b border-border flex items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-foreground">
              {row.label}
            </h2>
            {row.mandatory && (
              <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                required
              </span>
            )}
            {row.aiGenerated && (
              <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" /> AI-generated — please review
              </Badge>
            )}
          </header>
          <div className="p-4 space-y-2">
            <p className="text-[11.5px] text-muted-foreground">{row.hint}</p>
            <textarea
              value={row.content}
              disabled={alreadySubmitted}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.key === row.key ? { ...r, content: e.target.value } : r,
                  ),
                )
              }
              rows={row.content.split("\n").length + 2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder={row.mandatory ? "Required before submitting" : "Optional"}
            />
            {!alreadySubmitted && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingKey === row.key}
                  onClick={() => saveSection(row.key)}
                >
                  {savingKey === row.key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save section
                </Button>
              </div>
            )}
          </div>
        </section>
      ))}

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {alreadySubmitted ? (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-[13px] text-foreground">
          This brief has been confirmed and is with our team for review.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background p-5 space-y-3">
          {missingMandatory.length > 0 && (
            <p className="text-[12.5px] text-amber-700">
              Still needed before you can submit:{" "}
              {missingMandatory.map((r) => r.label).join(", ")}
            </p>
          )}
          <Button
            onClick={confirm}
            disabled={confirming || missingMandatory.length > 0}
            className="w-full"
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Confirm & submit for partner matching
          </Button>
          <p className="text-center text-[11.5px] text-muted-foreground">
            Save any edited sections first — submitting locks the brief for
            our team&apos;s review.
          </p>
        </div>
      )}
    </div>
  );
}
