"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  adminUpsertNotificationTemplateAction,
  adminResetNotificationTemplateAction,
} from "@/lib/actions/notification-templates";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface TemplateRow {
  key: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
  subject: string;
  body: string;
  overridden: boolean;
}

export function TemplateEditor({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<
    Record<string, { subject: string; body: string }>
  >({});
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const draftOf = (t: TemplateRow) =>
    drafts[t.key] ?? { subject: t.subject, body: t.body };

  const save = async (t: TemplateRow) => {
    const d = draftOf(t);
    setSavingKey(t.key);
    setError(null);
    const result = await adminUpsertNotificationTemplateAction({
      key: t.key,
      subject: d.subject,
      body: d.body,
    });
    setSavingKey(null);
    if (result.ok) router.refresh();
    else setError(mapErrorToToast(result.error));
  };

  const reset = async (t: TemplateRow) => {
    setSavingKey(t.key);
    setError(null);
    const result = await adminResetNotificationTemplateAction({ key: t.key });
    setSavingKey(null);
    if (result.ok) {
      setDrafts((prev) => ({
        ...prev,
        [t.key]: { subject: t.defaultSubject, body: t.defaultBody },
      }));
      router.refresh();
    } else {
      setError(mapErrorToToast(result.error));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border">
      {templates.map((t) => {
        const d = draftOf(t);
        const isOpen = open === t.key;
        return (
          <div key={t.key} className="px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : t.key)}
              className="w-full flex items-center gap-2 text-left"
            >
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-[13px] font-mono font-medium text-foreground">
                {t.key}
              </span>
              {t.overridden && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  customized
                </Badge>
              )}
              <span className="ml-auto text-[11.5px] text-muted-foreground truncate max-w-[45%]">
                {t.description}
              </span>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={d.subject}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [t.key]: { ...d, subject: e.target.value },
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
                />
                <textarea
                  value={d.body}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [t.key]: { ...d, body: e.target.value },
                    }))
                  }
                  rows={6}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12.5px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-2 justify-end">
                  {t.overridden && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={savingKey === t.key}
                      onClick={() => reset(t)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset to default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={savingKey === t.key}
                    onClick={() => save(t)}
                  >
                    {savingKey === t.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save override
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {error && (
        <p className="px-5 py-3 text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
