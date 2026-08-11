"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminUpdateSettingAction } from "@/lib/actions/settings";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface SettingRow {
  key: string;
  value: string; // JSON-encoded
  defaultValue: string;
  description: string;
  updatedAt: string | null;
}

export function SettingsEditor({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (key: string) => {
    setSavingKey(key);
    setError(null);
    const result = await adminUpdateSettingAction({ key, value: values[key] });
    setSavingKey(null);
    if (result.ok) router.refresh();
    else setError(`${key}: ${mapErrorToToast(result.error)}`);
  };

  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border">
      {settings.map((s) => (
        <div key={s.key} className="px-5 py-4 grid gap-2 sm:grid-cols-[240px_1fr_auto] sm:items-center">
          <div>
            <div className="text-[13px] font-mono font-medium text-foreground">
              {s.key}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              {s.description}
            </p>
          </div>
          <input
            type="text"
            value={values[s.key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [s.key]: e.target.value }))
            }
            className="rounded-md border border-border bg-background px-3 py-1.5 text-[13px] font-mono outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={savingKey === s.key || values[s.key] === s.value}
              onClick={() => save(s.key)}
            >
              {savingKey === s.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title={`Reset to default: ${s.defaultValue}`}
              onClick={() =>
                setValues((prev) => ({ ...prev, [s.key]: s.defaultValue }))
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
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
