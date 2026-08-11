"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  X,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileText,
  Target,
  Layers,
  Users,
  Calendar,
  DollarSign,
  Shield,
} from "lucide-react";
import {
  SOW_EXAMPLES,
  type SowExample,
  type SowExampleTier,
} from "@/lib/sow-examples";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for tier accents. The whole modal speaks one
 * color language driven by the active tier — neutral chrome, tier-tinted
 * content — so nothing competes with a stray brand-blue.
 */
const TIER_TONE: Record<
  SowExampleTier,
  {
    text: string;
    solid: string;
    softBg: string;
    softBorder: string;
    tabActive: string;
    tabIdle: string;
  }
> = {
  exemplar: {
    text: "text-success",
    solid: "bg-success text-white",
    softBg: "bg-success/5",
    softBorder: "border-success/20",
    tabActive: "border-success bg-success/10 text-success",
    tabIdle: "border-border text-muted-foreground hover:border-success/40",
  },
  solid: {
    text: "text-warning",
    solid: "bg-warning text-white",
    softBg: "bg-warning/5",
    softBorder: "border-warning/20",
    tabActive: "border-warning bg-warning/10 text-warning",
    tabIdle: "border-border text-muted-foreground hover:border-warning/40",
  },
  starter: {
    text: "text-muted-foreground",
    solid: "bg-muted-foreground text-white",
    softBg: "bg-secondary/40",
    softBorder: "border-border",
    tabActive: "border-muted-foreground bg-secondary text-foreground",
    tabIdle:
      "border-border text-muted-foreground hover:border-muted-foreground/40",
  },
};

export function SowExamplesDrawer({
  triggerLabel = "See examples",
  triggerVariant = "outline",
}: {
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(
    SOW_EXAMPLES[SOW_EXAMPLES.length - 1].id,
  );
  const selected = SOW_EXAMPLES.find((e) => e.id === selectedId)!;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5"
      >
        <BookOpen className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-6 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          >
          <div
            className="bg-white w-full max-w-5xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full sm:max-h-[92vh] animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Examples of great SoWs
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    See what strong answers look like, across three tiers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tier tabs */}
            <div className="px-6 pt-4 shrink-0 border-b border-border">
              <div className="flex gap-2 overflow-x-auto pb-3">
                {SOW_EXAMPLES.map((e) => (
                  <TierTab
                    key={e.id}
                    example={e}
                    active={e.id === selectedId}
                    onClick={() => setSelectedId(e.id)}
                  />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <ExampleBody example={selected} />
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-3 border-t border-border bg-secondary/30 flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                Ready to build yours? Keep going in the chat — aim for the{" "}
                <span className="font-semibold text-foreground">Exemplar</span>{" "}
                tier.
              </p>
              <Button size="sm" onClick={() => setOpen(false)}>
                Back to chat
              </Button>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function TierTab({
  example,
  active,
  onClick,
}: {
  example: SowExample;
  active: boolean;
  onClick: () => void;
}) {
  const tone = TIER_TONE[example.tier];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 text-left px-4 py-2.5 rounded-xl border-2 transition-all min-w-[200px]",
        active ? tone.tabActive : tone.tabIdle,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold">
          {example.tierLabel}
        </span>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
            tone.solid,
          )}
        >
          {example.tierScore}%
        </span>
      </div>
      <div className="text-sm font-semibold mt-1 text-foreground line-clamp-1">
        {example.title}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
        {example.industry}
      </div>
    </button>
  );
}

function ExampleBody({ example }: { example: SowExample }) {
  const b = example.brief;
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Headline */}
      <div className="flex items-start gap-3">
        <TierBadge example={example} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground leading-tight">
            {example.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {example.oneLiner}
          </p>
        </div>
      </div>

      {/* Why this tier */}
      <div
        className={cn(
          "rounded-xl border p-4 space-y-2",
          TIER_TONE[example.tier].softBorder,
          TIER_TONE[example.tier].softBg,
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
            TIER_TONE[example.tier].text,
          )}
        >
          {example.tier === "exemplar" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          Why this scores {example.tierScore}%
        </div>
        <ul className="space-y-1">
          {example.whyThisTier.map((w, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <span className="mt-1 text-xs opacity-60">●</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Executive summary */}
      <Section icon={<FileText />} title="Executive summary">
        {b.executiveSummary ? (
          <p className="text-sm leading-relaxed text-foreground">
            {b.executiveSummary}
          </p>
        ) : (
          <EmptyNote />
        )}
      </Section>

      {/* Facts strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FactCard
          icon={<Calendar />}
          label="Go-live"
          value={b.targetGoLive}
        />
        <FactCard
          icon={<DollarSign />}
          label="Budget"
          value={b.budgetRange}
          accentClass={TIER_TONE[example.tier].text}
        />
        <FactCard
          icon={<Shield />}
          label="Region"
          value={b.preferredLocation}
        />
      </div>

      {/* Scope */}
      <Section icon={<Layers />} title="Scope & requirements">
        {b.scopeRequirements.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {b.scopeRequirements.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-white p-3"
              >
                <div className="text-[10px] font-mono text-muted-foreground font-bold">
                  REQ-{String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-sm font-semibold text-foreground mt-1">
                  {r.title}
                </div>
                {r.detail && (
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {r.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Success criteria */}
      <Section icon={<Target />} title="Success criteria">
        {b.successCriteria.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="text-left px-4 py-2">Metric</th>
                  <th className="text-left px-4 py-2">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {b.successCriteria.map((s, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2 text-foreground font-medium">
                      {s.metric}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {s.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Stakeholders */}
      <Section icon={<Users />} title="Stakeholders & selection">
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniList label="Roles served" items={b.customerRoles} />
          <MiniList label="Decision makers" items={b.decisionMakers} />
        </div>
        <MiniList label="Selection criteria" items={b.selectionCriteria} />
      </Section>

      {/* Tail */}
      {b.milestones.length > 0 && (
        <Section icon={<Calendar />} title="Milestones">
          <div className="border-l-2 border-border pl-4 space-y-2">
            {b.milestones.map((m, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-foreground ring-2 ring-white" />
                <div className="text-sm font-semibold text-foreground">
                  {m.title}
                </div>
                <div className="text-xs text-muted-foreground">{m.date}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniList label="Services required" items={b.services} />
        <MiniList label="Compliance" items={b.requiredCertifications} />
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function FactCard({
  icon,
  label,
  value,
  accentClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold leading-snug",
          accentClass ?? "text-foreground",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span
            key={i}
            className="text-xs px-2 py-0.5 rounded-md border border-border bg-secondary text-foreground"
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyNote() {
  return (
    <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
      <AlertCircle className="h-3 w-3" /> Not provided
    </div>
  );
}

function TierBadge({ example }: { example: SowExample }) {
  return (
    <div
      className={cn(
        "shrink-0 grid place-items-center rounded-xl h-16 w-16",
        TIER_TONE[example.tier].solid,
      )}
    >
      <div className="text-xl font-bold leading-none">{example.tierScore}</div>
      <div className="text-[9px] uppercase tracking-wider font-semibold mt-0.5 opacity-90">
        {example.tierLabel}
      </div>
    </div>
  );
}
