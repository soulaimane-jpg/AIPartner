"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminSetPreferenceQuestionAction } from "@/lib/actions/partner-admin";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface QuestionRow {
  fieldKey: string;
  label: string;
  enabled: boolean;
  rank: number;
}

export function PreferenceQuestionsEditor({
  questions,
}: {
  questions: QuestionRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(questions);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (row: QuestionRow) => {
    setSavingKey(row.fieldKey);
    setError(null);
    const result = await adminSetPreferenceQuestionAction({
      fieldKey: row.fieldKey as never,
      label: row.label,
      enabled: row.enabled,
      rank: row.rank,
    });
    setSavingKey(null);
    if (result.ok) router.refresh();
    else setError(mapErrorToToast(result.error));
  };

  const patch = (fieldKey: string, patchObj: Partial<QuestionRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.fieldKey === fieldKey ? { ...r, ...patchObj } : r)),
    );

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border">
      {rows.map((q) => (
        <div
          key={q.fieldKey}
          className="px-5 py-3 grid gap-2 sm:grid-cols-[140px_1fr_auto_auto] sm:items-center"
        >
          <span className="text-[12.5px] font-mono text-muted-foreground">
            {q.fieldKey}
          </span>
          <input
            type="text"
            value={q.label}
            onChange={(e) => patch(q.fieldKey, { label: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={q.enabled}
              onChange={(e) => patch(q.fieldKey, { enabled: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            Enabled
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={savingKey === q.fieldKey}
            onClick={() => save(q)}
          >
            {savingKey === q.fieldKey ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      ))}
      {error && (
        <p className="px-5 py-3 text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
