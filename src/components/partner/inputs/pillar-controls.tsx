"use client";

/**
 * Micro-input controls for the pillar fields.
 *
 * The point of every control here is to replace a text box with something
 * that takes one click and produces comparable data. A partner typing
 * "we can usually start in a couple of weeks" is unusable; a partner clicking
 * "1–2 weeks" is filterable, sortable and matchable.
 */

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FieldOption } from "@/lib/partner-pillars";
import type { NumericRange } from "@/lib/partner-pillar-values";

// ─── Single choice ────────────────────────────────────────────

export function SegmentedChoice({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly FieldOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            // Clicking the active option clears it — otherwise a mis-click on
            // an optional field is permanent and the partner can't get back
            // to "unanswered".
            onClick={() => onChange(active ? "" : opt.value)}
            className={cn(
              "rounded-xl border p-3.5 text-left transition-colors",
              active
                ? "border-primary bg-primary-soft shadow-elev-1"
                : "border-line bg-card hover:border-line-strong hover:bg-secondary/50",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <div
              className={cn(
                "text-[12.5px] font-semibold",
                active ? "text-primary" : "text-foreground",
              )}
            >
              {opt.label}
            </div>
            {opt.hint && (
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {opt.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Multi choice ─────────────────────────────────────────────

export function MultiChoice({
  options,
  value,
  onChange,
  max,
  disabled,
}: {
  options: readonly FieldOption[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
      return;
    }
    if (max !== undefined && value.length >= max) return;
    onChange([...value, v]);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => {
          const active = value.includes(opt.value);
          const blocked =
            !active && max !== undefined && value.length >= max;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled || blocked}
              onClick={() => toggle(opt.value)}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary-soft shadow-elev-1"
                  : "border-line bg-card hover:border-line-strong hover:bg-secondary/50",
                (disabled || blocked) && "cursor-not-allowed opacity-50",
              )}
            >
              <div
                className={cn(
                  "text-[12.5px] font-semibold",
                  active ? "text-primary" : "text-foreground",
                )}
              >
                {opt.label}
              </div>
              {opt.hint && (
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {opt.hint}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {max !== undefined && (
        <p className="text-[11.5px] text-muted-foreground">
          {value.length} of {max} selected.
        </p>
      )}
    </div>
  );
}

// ─── Seniority ratio ──────────────────────────────────────────

export function RatioSlider({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  // Untouched sliders must not be scored as answered, so the control starts
  // in an explicit "not set" state rather than defaulting to 50.
  const current = value ?? 50;

  return (
    <div className="space-y-3">
      {value === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(50)}
          className="h-10 bg-card text-[12.5px]"
        >
          Set a seniority mix
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between text-[12px] font-medium">
            <span className="text-primary">{current}% senior / lead</span>
            <span className="text-muted-foreground">
              {100 - current}% mid / junior
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={current}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11.5px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

// ─── Numeric range ────────────────────────────────────────────

export function RangeInput({
  value,
  onChange,
  lowLabel = "From",
  highLabel = "To",
  suffix,
  min = 0,
  max,
  disabled,
}: {
  value: NumericRange;
  onChange: (v: NumericRange) => void;
  lowLabel?: string;
  highLabel?: string;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const parse = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-[11.5px] text-muted-foreground">{lowLabel}</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          disabled={disabled}
          value={value.low ?? ""}
          onChange={(e) => onChange({ ...value, low: parse(e.target.value) })}
          className="h-11 w-28 rounded-xl bg-white font-mono text-[13px]"
        />
      </div>
      <Minus className="mb-3.5 h-3.5 w-3.5 text-muted-foreground" />
      <div className="space-y-1.5">
        <Label className="text-[11.5px] text-muted-foreground">{highLabel}</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          disabled={disabled}
          value={value.high ?? ""}
          onChange={(e) => onChange({ ...value, high: parse(e.target.value) })}
          className="h-11 w-28 rounded-xl bg-white font-mono text-[13px]"
        />
      </div>
      {suffix && (
        <span className="mb-3.5 text-[12.5px] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── Repeater shell ───────────────────────────────────────────

export function RepeaterCard({
  index,
  onRemove,
  children,
  title,
}: {
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface-sunk p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title} {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${title} ${index + 1}`}
          className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}

export function AddRepeaterButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-10 border-line bg-card px-5 text-[12.5px] font-semibold"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}

// ─── Char-limited text ────────────────────────────────────────

export function LimitedTextarea({
  value,
  onChange,
  limit,
  placeholder,
  rows = 3,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  limit: number;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const remaining = limit - value.length;

  return (
    <div className="space-y-1.5">
      <textarea
        rows={rows}
        value={value}
        disabled={disabled}
        // Hard-truncate rather than allowing overflow then rejecting on save —
        // the limit is the point, and a server-side rejection after five
        // minutes of typing is a hostile way to communicate it.
        onChange={(e) => onChange(e.target.value.slice(0, limit))}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-relaxed text-slate-900 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
      />
      <div
        className={cn(
          "text-right text-[11px] tabular-nums",
          remaining <= 20 ? "text-amber-600" : "text-muted-foreground",
        )}
      >
        {remaining} characters left
      </div>
    </div>
  );
}
