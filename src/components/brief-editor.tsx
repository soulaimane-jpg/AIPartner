"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  FileText,
  Layers,
  Target,
  Database,
  GitBranch,
  Calendar,
  Users,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBriefAction } from "@/lib/actions/briefs";

export type EditorState = {
  title: string;
  executiveSummary: string;
  targetGoLive: string;
  budgetRange: string;
  preferredLocation: string;
  procurementType: string;
  scopeRequirements: { title: string; detail: string }[];
  successCriteria: { metric: string; target: string }[];
  dataSources: { name: string; detail: string }[];
  integrationPoints: { title: string; detail: string }[];
  customerRoles: string[];
  milestones: { title: string; date: string }[];
  requiredCertifications: string[];
  industryExperience: string[];
  decisionMakers: string[];
  selectionCriteria: string[];
  services: string[];
};

export function BriefEditor({
  briefId,
  initial,
}: {
  briefId: string;
  initial: EditorState;
}) {
  const router = useRouter();
  const [state, setState] = useState<EditorState>(initial);
  const [pending, startTransition] = useTransition();

  const patch = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const save = () => {
    startTransition(async () => {
      const result = await updateBriefAction({
        briefId,
        patch: {
          title: state.title,
          executiveSummary: state.executiveSummary,
          targetGoLive: state.targetGoLive,
          budgetRange: state.budgetRange,
          preferredLocation: state.preferredLocation,
          procurementType: state.procurementType,
          scopeRequirements: state.scopeRequirements,
          successCriteria: state.successCriteria,
          dataSources: state.dataSources,
          integrationPoints: state.integrationPoints,
          customerRoles: state.customerRoles,
          milestones: state.milestones,
          requiredCertifications: state.requiredCertifications,
          industryExperience: state.industryExperience,
          decisionMakers: state.decisionMakers,
          selectionCriteria: state.selectionCriteria,
          services: state.services,
        },
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Save failed")
            : result.error.code === "FORBIDDEN"
              ? "You don't have permission to edit this brief."
              : "Save failed",
        );
        return;
      }
      toast.success("SoW saved");
      router.refresh();
    });
  };

  return (
    <div className="space-y-8 pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-card/90 backdrop-blur border-b border-border flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Editing SoW
          </div>
          <div className="text-sm font-semibold text-foreground truncate max-w-md">
            {state.title || "Untitled"}
          </div>
        </div>
        <Button onClick={save} disabled={pending} className="h-10 px-5">
          <Save className="h-4 w-4 mr-2" />
          {pending ? "Saving…" : "Save all changes"}
        </Button>
      </div>

      <SectionCard icon={<FileText />} title="Project Identity">
        <Field label="Title">
          <Input
            value={state.title}
            onChange={(e) => patch("title", e.target.value)}
            placeholder="Short name for this project"
          />
        </Field>
        <Field label="Executive summary">
          <Textarea
            rows={5}
            value={state.executiveSummary}
            onChange={(e) => patch("executiveSummary", e.target.value)}
            placeholder="What problem are we solving and why now?"
          />
        </Field>
      </SectionCard>

      <SectionCard icon={<Layers />} title="Scope & Requirements">
        <ObjectListEditor
          items={state.scopeRequirements}
          onChange={(v) => patch("scopeRequirements", v)}
          fields={[
            { key: "title", label: "Requirement title", placeholder: "Ingest IoT telemetry" },
            { key: "detail", label: "Detail", placeholder: "Stream 200 events/sec from factory floor…", textarea: true },
          ]}
          addLabel="Add requirement"
          emptyHint="No scope items yet."
        />
      </SectionCard>

      <SectionCard icon={<Target />} title="Success Criteria">
        <ObjectListEditor
          items={state.successCriteria}
          onChange={(v) => patch("successCriteria", v)}
          fields={[
            { key: "metric", label: "Metric", placeholder: "Monthly active users" },
            { key: "target", label: "Target", placeholder: "10k by Q4" },
          ]}
          addLabel="Add KPI"
          emptyHint="No KPIs yet."
        />
      </SectionCard>

      <SectionCard icon={<Database />} title="Data Sources">
        <ObjectListEditor
          items={state.dataSources}
          onChange={(v) => patch("dataSources", v)}
          fields={[
            { key: "name", label: "Source name", placeholder: "Salesforce CRM" },
            { key: "detail", label: "Detail", placeholder: "~50M records, exported nightly", textarea: true },
          ]}
          addLabel="Add source"
          emptyHint="No data sources yet."
        />
      </SectionCard>

      <SectionCard icon={<GitBranch />} title="Integration Points">
        <ObjectListEditor
          items={state.integrationPoints}
          onChange={(v) => patch("integrationPoints", v)}
          fields={[
            { key: "title", label: "System", placeholder: "Stripe billing" },
            { key: "detail", label: "Detail", placeholder: "Daily invoice sync", textarea: true },
          ]}
          addLabel="Add integration"
          emptyHint="No integrations yet."
        />
      </SectionCard>

      <SectionCard icon={<Calendar />} title="Timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target go-live">
            <Input
              value={state.targetGoLive}
              onChange={(e) => patch("targetGoLive", e.target.value)}
              placeholder="e.g. Q3 2026"
            />
          </Field>
          <Field label="Budget range">
            <Input
              value={state.budgetRange}
              onChange={(e) => patch("budgetRange", e.target.value)}
              placeholder="e.g. $150k–$250k USD"
            />
          </Field>
        </div>
        <Field label="Key milestones">
          <ObjectListEditor
            items={state.milestones}
            onChange={(v) => patch("milestones", v)}
            fields={[
              { key: "title", label: "Milestone", placeholder: "Pilot deployment" },
              { key: "date", label: "Date", placeholder: "Sep 2026" },
            ]}
            addLabel="Add milestone"
            emptyHint=""
            compact
          />
        </Field>
      </SectionCard>

      <SectionCard icon={<Shield />} title="Constraints & Compliance">
        <Field label="Preferred region / data residency">
          <Input
            value={state.preferredLocation}
            onChange={(e) => patch("preferredLocation", e.target.value)}
            placeholder="EMEA, data in Netherlands"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required certifications">
            <StringListEditor
              values={state.requiredCertifications}
              onChange={(v) => patch("requiredCertifications", v)}
              placeholder="ISO 27001, SOC2, HIPAA…"
            />
          </Field>
          <Field label="Industry experience needed">
            <StringListEditor
              values={state.industryExperience}
              onChange={(v) => patch("industryExperience", v)}
              placeholder="Healthcare, Retail…"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={<Users />} title="Stakeholders & Selection">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer roles served">
            <StringListEditor
              values={state.customerRoles}
              onChange={(v) => patch("customerRoles", v)}
              placeholder="Financial analysts, Ops engineers…"
            />
          </Field>
          <Field label="Decision makers">
            <StringListEditor
              values={state.decisionMakers}
              onChange={(v) => patch("decisionMakers", v)}
              placeholder="CTO, VP Data…"
            />
          </Field>
        </div>
        <Field label="Partner selection criteria">
          <StringListEditor
            values={state.selectionCriteria}
            onChange={(v) => patch("selectionCriteria", v)}
            placeholder="GCP Data Analytics specialization, Fixed-price, EMEA team…"
          />
        </Field>
      </SectionCard>

      <SectionCard icon={<CheckCircle2 />} title="Services & Procurement">
        <Field label="Services needed">
          <StringListEditor
            values={state.services}
            onChange={(v) => patch("services", v)}
            placeholder="Data Analytics, Machine Learning…"
          />
        </Field>
        <Field label="Procurement path">
          <div className="flex flex-wrap gap-2">
            {[
              { v: "DIRECT_GOOGLE", l: "Direct Google" },
              { v: "VIA_RESELLER", l: "Via reseller" },
              { v: "UNSURE", l: "Not sure yet" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => patch("procurementType", o.v)}
                className={`px-4 h-10 rounded-lg border text-sm transition-all ${
                  state.procurementType === o.v
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-card text-foreground hover:border-primary/30"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>
      </SectionCard>

      {/* Floating save */}
      <div className="fixed bottom-6 right-6 z-20">
        <Button
          onClick={save}
          disabled={pending}
          size="lg"
          className="shadow-xl h-12 px-6"
        >
          <Save className="h-4 w-4 mr-2" />
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

type ListField = {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
};

function ObjectListEditor<T extends Record<string, string>>({
  items,
  onChange,
  fields,
  addLabel,
  emptyHint,
  compact = false,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  fields: ListField[];
  addLabel: string;
  emptyHint: string;
  compact?: boolean;
}) {
  const addItem = () => {
    const empty = Object.fromEntries(fields.map((f) => [f.key, ""])) as T;
    onChange([...items, empty]);
  };
  const updateItem = (idx: number, key: string, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value } as T;
    onChange(next);
  };
  const removeItem = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {items.length === 0 && emptyHint && (
        <div className="text-xs text-muted-foreground italic">{emptyHint}</div>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          className={`rounded-xl border border-border bg-secondary/20 ${
            compact ? "p-3" : "p-4"
          } relative group`}
        >
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className={compact ? "grid gap-2 sm:grid-cols-2" : "space-y-3"}>
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                {!compact && (
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    {f.label}
                  </Label>
                )}
                {f.textarea ? (
                  <Textarea
                    rows={2}
                    value={item[f.key as keyof T] ?? ""}
                    onChange={(e) => updateItem(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <Input
                    value={item[f.key as keyof T] ?? ""}
                    onChange={(e) => updateItem(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="h-9"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        {addLabel}
      </Button>
    </div>
  );
}

function StringListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-primary/60 hover:text-destructive"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="h-9 shrink-0"
          disabled={!draft.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
