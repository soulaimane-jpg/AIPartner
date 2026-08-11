"use client";

/**
 * Renders one registry field, dispatching on its declared control.
 *
 * This is the component that makes "one registry drives both surfaces" real:
 * the profile editor and the onboarding wizard both render `<PillarField>` and
 * therefore cannot drift apart. Adding a field to the registry makes it appear
 * in both places with validation already wired.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldMeta } from "@/lib/partner-pillars";
import {
  ASSET_ACCESS_OPTIONS,
  ASSET_IMPACT_OPTIONS,
} from "@/lib/partner-pillars";
import {
  EMPTY_CASE_STUDY,
  EMPTY_IP_ASSET,
  type CaseStudy,
  type IpAsset,
  type NumericRange,
  type ValueRanges,
} from "@/lib/partner-pillar-values";
import { TagPicker } from "@/components/partner/inputs/tag-picker";
import {
  AddRepeaterButton,
  LimitedTextarea,
  MultiChoice,
  RangeInput,
  RatioSlider,
  RepeaterCard,
  SegmentedChoice,
} from "@/components/partner/inputs/pillar-controls";

export function PillarField({
  field,
  value,
  onChange,
  tagLabels,
  disabled,
}: {
  field: FieldMeta;
  value: unknown;
  onChange: (next: unknown) => void;
  tagLabels?: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <Label className="text-[13px] font-semibold text-foreground">
          {field.label}
          {field.required && (
            <span className="ml-1.5 text-[11px] font-medium text-primary">
              required
            </span>
          )}
        </Label>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
          {field.hint}
        </p>
      </div>
      <FieldControl
        field={field}
        value={value}
        onChange={onChange}
        tagLabels={tagLabels}
        disabled={disabled}
      />
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  tagLabels,
  disabled,
}: {
  field: FieldMeta;
  value: unknown;
  onChange: (next: unknown) => void;
  tagLabels?: Record<string, string>;
  disabled?: boolean;
}) {
  switch (field.control) {
    case "tags":
      return (
        <TagPicker
          facet={field.facet!}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          max={field.maxSelections}
          initialLabels={tagLabels ?? {}}
          disabled={disabled}
        />
      );

    case "segmented":
      return (
        <SegmentedChoice
          options={field.options ?? []}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "multi":
      return (
        <MultiChoice
          options={field.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          max={field.maxSelections}
          disabled={disabled}
        />
      );

    case "ratio":
      return (
        <RatioSlider
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "range":
      return field.key === "valueRanges" ? (
        <ValueRangesControl
          value={(value ?? {}) as ValueRanges}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <RangeInput
          value={(value ?? { low: null, high: null }) as NumericRange}
          onChange={onChange}
          suffix="months"
          disabled={disabled}
        />
      );

    case "text":
      return (
        <LimitedTextarea
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          limit={field.charLimit ?? 300}
          disabled={disabled}
        />
      );

    case "repeater":
      return field.key === "ipAssets" ? (
        <IpAssetRepeater
          value={Array.isArray(value) ? (value as IpAsset[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <CaseStudyRepeater
          value={Array.isArray(value) ? (value as CaseStudy[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      );
  }
}

// ─── Value ranges ─────────────────────────────────────────────

function ValueRangesControl({
  value,
  onChange,
  disabled,
}: {
  value: ValueRanges;
  onChange: (v: ValueRanges) => void;
  disabled?: boolean;
}) {
  const empty: NumericRange = { low: null, high: null };
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="text-[12px] font-medium text-foreground">
          Cloud cost savings achieved
        </span>
        <RangeInput
          value={value.cloudSavingsPct ?? empty}
          onChange={(r) => onChange({ ...value, cloudSavingsPct: r })}
          suffix="%"
          min={0}
          max={100}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <span className="text-[12px] font-medium text-foreground">
          Typical migration duration
        </span>
        <RangeInput
          value={value.migrationMonths ?? empty}
          onChange={(r) => onChange({ ...value, migrationMonths: r })}
          suffix="months"
          min={0}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ─── IP assets ────────────────────────────────────────────────

function IpAssetRepeater({
  value,
  onChange,
  disabled,
}: {
  value: IpAsset[];
  onChange: (v: IpAsset[]) => void;
  disabled?: boolean;
}) {
  const patch = (i: number, p: Partial<IpAsset>) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...p } : a)));

  return (
    <div className="space-y-4">
      {value.map((asset, i) => (
        <RepeaterCard
          key={i}
          index={i}
          title="Asset"
          onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Asset name
              </Label>
              <Input
                value={asset.name}
                disabled={disabled}
                onChange={(e) => patch(i, { name: e.target.value })}
                placeholder="Terraform Landing Zone Kit"
                className="h-11 rounded-xl bg-white text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Time saved
              </Label>
              <Input
                value={asset.timeSaved}
                disabled={disabled}
                onChange={(e) => patch(i, { timeSaved: e.target.value })}
                placeholder="3 weeks → 2 days"
                className="h-11 rounded-xl bg-white text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] text-muted-foreground">
              What it does
            </Label>
            <LimitedTextarea
              value={asset.description}
              onChange={(v) => patch(i, { description: v })}
              limit={300}
              rows={2}
              disabled={disabled}
              placeholder="One or two sentences. What does the client get on day one?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Access model
              </Label>
              <select
                value={asset.access}
                disabled={disabled}
                onChange={(e) => patch(i, { access: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900"
              >
                <option value="">Not specified</option>
                {ASSET_ACCESS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Primary impact
              </Label>
              <select
                value={asset.impact}
                disabled={disabled}
                onChange={(e) => patch(i, { impact: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900"
              >
                <option value="">Not specified</option>
                {ASSET_IMPACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </RepeaterCard>
      ))}

      {value.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line py-10 text-center text-[12.5px] text-muted-foreground">
          No assets yet. This is the strongest differentiator you can add.
        </div>
      )}

      {!disabled && (
        <AddRepeaterButton
          onClick={() => onChange([...value, { ...EMPTY_IP_ASSET }])}
          label="Add asset"
          disabled={value.length >= 25}
        />
      )}
    </div>
  );
}

// ─── Case studies ─────────────────────────────────────────────

function CaseStudyRepeater({
  value,
  onChange,
  disabled,
}: {
  value: CaseStudy[];
  onChange: (v: CaseStudy[]) => void;
  disabled?: boolean;
}) {
  const patch = (i: number, p: Partial<CaseStudy>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  return (
    <div className="space-y-4">
      {value.map((cs, i) => (
        <RepeaterCard
          key={i}
          index={i}
          title="Case study"
          onRemove={() => onChange(value.filter((_, idx) => idx !== i))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Headline
              </Label>
              <Input
                value={cs.title}
                disabled={disabled}
                onChange={(e) => patch(i, { title: e.target.value })}
                className="h-11 rounded-xl bg-white text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Client
              </Label>
              <Input
                value={cs.client}
                disabled={disabled}
                onChange={(e) => patch(i, { client: e.target.value })}
                placeholder="Leave blank if confidential"
                className="h-11 rounded-xl bg-white text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                Industry
              </Label>
              <Input
                value={cs.industry}
                disabled={disabled}
                onChange={(e) => patch(i, { industry: e.target.value })}
                className="h-11 rounded-xl bg-white text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11.5px] text-muted-foreground">
                When delivered
              </Label>
              {/* Recency is the point. A 2019 migration and a 2026 one are
                  not equivalent evidence, and buyers need to see which. */}
              <Input
                type="month"
                value={cs.engagementDate}
                disabled={disabled}
                onChange={(e) => patch(i, { engagementDate: e.target.value })}
                className="h-11 rounded-xl bg-white font-mono text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] text-muted-foreground">
              Measured outcome
            </Label>
            <LimitedTextarea
              value={cs.outcome}
              onChange={(v) => patch(i, { outcome: v })}
              limit={300}
              rows={2}
              disabled={disabled}
              placeholder="Cut BigQuery spend 38% while halving report latency."
            />
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
              <input
                type="checkbox"
                checked={cs.referenceAvailable}
                disabled={disabled}
                onChange={(e) =>
                  patch(i, { referenceAvailable: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-slate-300 accent-primary"
              />
              Reference call possible
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
              <input
                type="checkbox"
                checked={cs.confidential}
                disabled={disabled}
                onChange={(e) => patch(i, { confidential: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-primary"
              />
              Client name confidential
            </label>
          </div>
        </RepeaterCard>
      ))}

      {value.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line py-10 text-center text-[12.5px] text-muted-foreground">
          No case studies yet.
        </div>
      )}

      {!disabled && (
        <AddRepeaterButton
          onClick={() => onChange([...value, { ...EMPTY_CASE_STUDY }])}
          label="Add case study"
          disabled={value.length >= 25}
        />
      )}
    </div>
  );
}
