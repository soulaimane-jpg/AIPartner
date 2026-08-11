"use client";

import { useState } from "react";
import { Sparkles, Download, ShieldCheck, Eye, EyeOff, Linkedin, Globe, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  CustomerRawProfile,
  CustomerAnonymizedProfile,
} from "@/lib/customer-profile";

type Props = {
  initialLinkedin?: string;
  initialWebsite?: string;
  initialRaw?: CustomerRawProfile | null;
  initialAnonymized?: CustomerAnonymizedProfile | null;
};

export function CustomerProfileCard({
  initialLinkedin = "",
  initialWebsite = "",
  initialRaw = null,
  initialAnonymized = null,
}: Props) {
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedin);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite);
  const [raw, setRaw] = useState<CustomerRawProfile | null>(initialRaw);
  const [anon, setAnon] = useState<CustomerAnonymizedProfile | null>(
    initialAnonymized,
  );
  const [showRaw, setShowRaw] = useState(true);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!linkedinUrl.trim() && !websiteUrl.trim()) {
      toast.error("Paste a LinkedIn URL or company website");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/profile/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinUrl: linkedinUrl.trim(),
          websiteUrl: websiteUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed");
      setRaw(json.raw);
      setAnon(json.anonymized);
      toast.success("Profile extracted and saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" aria-busy={loading || undefined}>
      {/* Input card */}
      <div className="customer-panel space-y-5 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="portal-icon-box h-11 w-11">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Tell partners who you are — automatically
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Paste your LinkedIn profile or your company website. We&apos;ll
              extract a profile, then build an{" "}
              <span className="font-semibold">anonymized version</span> that
              rides along with every SoW you share — so partners know your
              industry, scale, and goals without seeing your identity.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <UrlField
            label="LinkedIn profile"
            icon={<Linkedin className="h-4 w-4" />}
            value={linkedinUrl}
            onChange={setLinkedinUrl}
            placeholder="https://www.linkedin.com/in/…"
          />
          <UrlField
            label="Company website"
            icon={<Globe className="h-4 w-4" />}
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="https://yourcompany.com"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={run}
            loading={loading}
            leftIcon={loading ? undefined : <Download className="h-4 w-4" />}
            className="h-10 w-full px-5 sm:w-auto"
          >
            {loading ? "Extracting…" : "Extract & anonymize"}
          </Button>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Anonymized version is what admins and partners see
          </span>
        </div>
      </div>

      {/* Results */}
      {(raw || anon) && (
        <>
          {/* Toggle */}
          <div className="flex flex-wrap items-center gap-2 text-xs" role="tablist" aria-label="Profile visibility">
            <span className="text-muted-foreground">Showing:</span>
            <button
              type="button"
              onClick={() => setShowRaw(true)}
              role="tab"
              aria-selected={showRaw}
              className={cn(
                "px-3 py-1 rounded-md font-semibold transition-all",
                showRaw
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <Eye className="h-3 w-3 inline mr-1.5" />
              Your private view
            </button>
            <button
              type="button"
              onClick={() => setShowRaw(false)}
              role="tab"
              aria-selected={!showRaw}
              className={cn(
                "px-3 py-1 rounded-md font-semibold transition-all",
                !showRaw
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <EyeOff className="h-3 w-3 inline mr-1.5" />
              What partners see (anonymized)
            </button>
          </div>

          {showRaw ? <RawView raw={raw!} /> : <AnonView anon={anon!} />}
        </>
      )}
    </div>
  );
}

function UrlField({
  label,
  icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const id = `profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs h-11"
      />
    </div>
  );
}

function RawView({ raw }: { raw: CustomerRawProfile }) {
  return (
    <div className="customer-panel space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Your private profile
          </div>
          <div className="text-lg font-semibold text-foreground mt-1">
            {raw.fullName || "—"}
          </div>
          <div className="text-sm text-muted-foreground">{raw.role}</div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-success/10 text-success border border-success/20">
          Only visible to you
        </span>
      </div>

      {raw.headline && (
        <p className="text-sm italic text-foreground/80">&ldquo;{raw.headline}&rdquo;</p>
      )}
      {raw.summary && (
        <p className="text-sm text-foreground leading-relaxed">{raw.summary}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <KV label="Company">{raw.company?.name || "—"}</KV>
        <KV label="Industry">{raw.company?.industry || "—"}</KV>
        <KV label="Company size">{raw.company?.size || "—"}</KV>
        <KV label="HQ">{raw.company?.hq || "—"}</KV>
        <KV label="Region">{raw.company?.region || "—"}</KV>
        <KV label="Seniority">{raw.seniority || "—"}</KV>
      </div>

      {raw.expertise?.length > 0 && (
        <ChipRow title="Expertise" items={raw.expertise} />
      )}
      {raw.careerHighlights?.length > 0 && (
        <ListBlock title="Career highlights" items={raw.careerHighlights} />
      )}
      {raw.pastProjects?.length > 0 && (
        <ListBlock title="Past projects" items={raw.pastProjects} />
      )}
      {raw.goals?.length > 0 && (
        <ListBlock title="Stated goals" items={raw.goals} />
      )}
    </div>
  );
}

function AnonView({ anon }: { anon: CustomerAnonymizedProfile }) {
  return (
    <div className="customer-panel space-y-5 border-primary/30 bg-primary/[0.03] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-primary">
            Anonymized — shared with SoWs
          </div>
          <div className="text-lg font-semibold text-foreground mt-1">
            {anon.roleCategory} · {anon.seniority}
          </div>
          <div className="text-sm text-muted-foreground">
            {anon.industry} · {anon.companySize} employees · {anon.companyRegion}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
          Visible to admins & matched partners
        </span>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          Names, emails, and the specific company are removed. Only the
          signals that help partners judge fit are kept.
        </span>
      </div>

      {anon.expertise.length > 0 && (
        <ChipRow title="Technology signals" items={anon.expertise} tone="primary" />
      )}
      {anon.maturitySignals.length > 0 && (
        <ChipRow
          title="Organizational maturity"
          items={anon.maturitySignals}
          tone="success"
        />
      )}
      {anon.pastProjectCategories.length > 0 && (
        <ChipRow
          title="Relevant past work"
          items={anon.pastProjectCategories}
          tone="muted"
        />
      )}
      {anon.goals.length > 0 && (
        <ListBlock title="Strategic goals" items={anon.goals} />
      )}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function ChipRow({
  title,
  items,
  tone = "muted",
}: {
  title: string;
  items: string[];
  tone?: "muted" | "primary" | "success";
}) {
  const toneMap = {
    muted: "bg-secondary text-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
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
              "text-xs px-2.5 py-1 rounded-md border",
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

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-sm text-foreground flex gap-2">
            <span className="text-primary mt-0.5">●</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
