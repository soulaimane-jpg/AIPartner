import { EyeOff, Quote, ShieldCheck } from "lucide-react";
import {
  buildAnonymizedNarrative,
  type CustomerAnonymizedProfile,
} from "@/lib/customer-profile";

/**
 * Shows the customer exactly what partners will see when the SoW is shared —
 * a short anonymized narrative plus the structured signal tags.
 *
 * Deliberately reassures the user that no PII / company name / contacts are
 * exposed at this stage.
 */
export function AnonymizedSummaryPreview({
  anon,
  companyName,
}: {
  anon: CustomerAnonymizedProfile | null;
  companyName?: string | null;
}) {
  const narrative = buildAnonymizedNarrative(anon);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <EyeOff className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              What partners will see
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              This is the anonymized summary we share with matched partners —
              enough signal to tell them if they&apos;re a fit, nothing that reveals
              who you are.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-md">
          <ShieldCheck className="h-3 w-3" /> Anonymized
        </span>
      </header>

      <div className="p-6 space-y-5">
        {/* Narrative */}
        <figure className="relative rounded-xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-transparent border border-primary/15 p-5">
          <Quote className="absolute top-3 left-3 h-4 w-4 text-primary/30" />
          <blockquote className="text-base leading-relaxed text-foreground pl-6">
            {narrative}
          </blockquote>
        </figure>

        {/* Signal tags */}
        {anon && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Fact label="Industry" value={anon.industry} />
            <Fact label="Company size" value={anon.companySize} suffix=" employees" />
            <Fact label="Region" value={anon.companyRegion} />
            <Fact
              label="Initiative lead"
              value={`${anon.roleCategory} · ${anon.seniority}`}
            />
          </div>
        )}

        {anon && anon.goals.length > 0 && (
          <TagGroup title="Strategic goals" items={anon.goals} tone="primary" />
        )}
        {anon && anon.maturitySignals.length > 0 && (
          <TagGroup
            title="Organizational readiness"
            items={anon.maturitySignals}
            tone="success"
          />
        )}
        {anon && anon.expertise.length > 0 && (
          <TagGroup
            title="Tech signals"
            items={anon.expertise.slice(0, 10)}
            tone="muted"
          />
        )}

        {/* Redaction notice */}
        <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-semibold">Hidden from partners:</strong>{" "}
          company name
          {companyName ? ` (“${companyName}”)` : ""}, your name, email, phone,
          website, and any named individuals. Partners only see the summary
          above plus the Statement of Work content — never identifiers. Your
          identity is revealed only after you approve a specific partner match.
        </div>
      </div>
    </section>
  );
}

function Fact({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  const shown = value && value !== "Unspecified" ? value + (suffix ?? "") : "—";
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{shown}</div>
    </div>
  );
}

function TagGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "primary" | "success" | "muted";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    muted: "bg-secondary text-foreground border-border",
  } as const;
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span
            key={i}
            className={`text-[11px] px-2 py-0.5 rounded-md border ${toneMap[tone]}`}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
