import { ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerAnonymizedProfile } from "@/lib/customer-profile";

export function AnonymizedCustomerProfileCard({
  anon,
}: {
  anon: CustomerAnonymizedProfile | null;
}) {
  if (!anon) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
          <div>
            The customer hasn&apos;t completed their anonymized profile yet. Only
            SoW content is available for this brief.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] overflow-hidden">
      <div className="px-5 py-3 border-b border-primary/15 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Anonymized customer context
        </span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {anon.roleCategory} · {anon.seniority}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {anon.industry} · {anon.companySize} employees ·{" "}
            {anon.companyRegion}
          </div>
        </div>

        {anon.expertise.length > 0 && (
          <TagRow title="Tech signals" items={anon.expertise} tone="primary" />
        )}
        {anon.maturitySignals.length > 0 && (
          <TagRow
            title="Organizational maturity"
            items={anon.maturitySignals}
            tone="success"
          />
        )}
        {anon.pastProjectCategories.length > 0 && (
          <TagRow
            title="Relevant past work"
            items={anon.pastProjectCategories}
            tone="muted"
          />
        )}
        {anon.goals.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Strategic goals
            </div>
            <ul className="space-y-1">
              {anon.goals.map((g, i) => (
                <li
                  key={i}
                  className="text-xs text-foreground leading-relaxed flex gap-2"
                >
                  <span className="text-primary">●</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function TagRow({
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
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-md border",
              toneMap[tone],
            )}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
