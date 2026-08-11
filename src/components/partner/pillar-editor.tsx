"use client";

/**
 * The 5-pillar profile editor.
 *
 * Renders one tab per pillar straight from the registry, plus a live strength
 * meter that tells the partner what to do next rather than just how incomplete
 * they are.
 *
 * Strength is computed client-side for instant feedback and recomputed
 * server-side on save — the server's number is authoritative and overwrites
 * the optimistic one.
 */

import { useMemo, useState, useTransition } from "react";
import { Check, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  fieldsForPillar,
  pillarsInOrder,
  type PillarKey,
} from "@/lib/partner-pillars";
import type { PillarValues } from "@/lib/partner-pillar-values";
import { computeProfileStrength } from "@/lib/partner-strength";
import { PillarField } from "@/components/partner/inputs/pillar-field";
import { savePillarProfileAction } from "@/lib/actions/partner-pillars";

export function PillarEditor({
  initialValues,
  tagLabels,
  initialStrength,
}: {
  initialValues: PillarValues;
  tagLabels: Record<string, string>;
  initialStrength: number;
}) {
  const [values, setValues] = useState<PillarValues>(initialValues);
  const [savedStrength, setSavedStrength] = useState(initialStrength);
  const [pending, startTransition] = useTransition();

  const pillars = useMemo(() => pillarsInOrder(), []);
  const strength = useMemo(() => computeProfileStrength(values), [values]);

  const setField = (key: string, next: unknown) =>
    setValues((prev) => ({ ...prev, [key]: next }));

  const save = () => {
    startTransition(async () => {
      const result = await savePillarProfileAction({ values });
      if (result.ok) {
        setSavedStrength(result.data.strength);
        toast.success("Profile saved");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Some fields need attention")
            : "Could not save your profile",
        );
      }
    });
  };

  // Unsaved edits shouldn't silently disagree with the server's stored score.
  const dirty = strength.score !== savedStrength;

  return (
    <div className="space-y-6">
      <StrengthBanner
        score={strength.score}
        savedScore={savedStrength}
        dirty={dirty}
        nextBestAction={strength.nextBestAction}
      />

      <Tabs defaultValue={pillars[0].key} className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-11 w-full justify-start overflow-x-auto rounded-xl border border-line p-1 lg:w-auto">
            {pillars.map((p) => {
              const progress = strength.perPillar.find((x) => x.key === p.key);
              return (
                <TabsTrigger
                  key={p.key}
                  value={p.key}
                  className="gap-1.5 rounded-lg text-xs font-semibold"
                >
                  {p.label}
                  {progress?.complete ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {progress?.percent ?? 0}%
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Button
            onClick={save}
            disabled={pending}
            className="h-11 shrink-0 px-6 font-semibold shadow-sm"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>

        {pillars.map((pillar) => (
          <TabsContent
            key={pillar.key}
            value={pillar.key}
            className="mt-0 animate-fade-in"
          >
            <PillarPanel
              pillarKey={pillar.key}
              label={pillar.label}
              hint={pillar.hint}
              values={values}
              onChange={setField}
              tagLabels={tagLabels}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function PillarPanel({
  pillarKey,
  label,
  hint,
  values,
  onChange,
  tagLabels,
}: {
  pillarKey: PillarKey;
  label: string;
  hint: string;
  values: PillarValues;
  onChange: (key: string, next: unknown) => void;
  tagLabels: Record<string, string>;
}) {
  const fields = useMemo(() => fieldsForPillar(pillarKey), [pillarKey]);

  return (
    <Card className="border-line bg-card shadow-elev-1">
      <CardContent className="space-y-9 p-5 sm:p-7 lg:p-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-9 w-[2px] shrink-0 bg-primary" />
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
              {label}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {hint}
            </p>
          </div>
        </div>

        <div className="space-y-9">
          {fields.map((field) => (
            <PillarField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(next) => onChange(field.key, next)}
              tagLabels={tagLabels}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StrengthBanner({
  score,
  savedScore,
  dirty,
  nextBestAction,
}: {
  score: number;
  savedScore: number;
  dirty: boolean;
  nextBestAction: string | null;
}) {
  return (
    <Card
      className={cn(
        "border-line shadow-none",
        score === 100 ? "bg-emerald-50/60" : "bg-surface-sunk",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp
              className={cn(
                "h-4 w-4",
                score === 100 ? "text-emerald-600" : "text-primary",
              )}
            />
            <span className="text-[13px] font-semibold text-foreground">
              Profile strength
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-primary">
              {score}%
            </span>
            {dirty && (
              <span className="text-[11px] text-muted-foreground">
                (saved: {savedScore}%)
              </span>
            )}
          </div>
          <Progress value={score} className="h-1.5" />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {nextBestAction ??
              "Every pillar is complete. Clients see a full picture of your capability."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
