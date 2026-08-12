"use client";

import { useState } from "react";
import { Download, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type Extracted = {
  name?: string;
  tagline?: string;
  description?: string;
  website?: string;
  headquarters?: string;
  teamSize?: string;
  industry?: string;
  gcpTier?: string;
  partnerSince?: string;
  languages?: string[];
  regions?: string[];
  officeLocations?: string[];
  serviceModels?: string[];
  specializations?: string[];
  expertiseAreas?: string[];
  industryExperience?: string[];
  keyClients?: string[];
  differentiators?: string[];
  certifications?: { name: string; count?: number; level?: string }[];
  caseStudies?: {
    title: string;
    client?: string;
    industry?: string;
    summary?: string;
    outcome?: string;
    link?: string;
  }[];
  awards?: { title: string; year: number; issuer?: string }[];
};

export function PartnerImportCard({
  initialUrl,
  onApply,
}: {
  initialUrl?: string;
  onApply: (patch: Extracted, sourceUrl: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Extracted | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");

  const runImport = async () => {
    if (!url.trim()) {
      toast.error("Paste a Google Cloud partner URL first");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/partner/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setPreview(json.data);
      setSourceUrl(json.sourceUrl);
      toast.success("Profile extracted — review and apply");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not extract profile",
      );
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!preview) return;
    onApply(preview, sourceUrl);
    toast.success("Applied — remember to save your profile");
    setPreview(null);
  };

  return (
    <div className="customer-panel space-y-6 p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="portal-icon-box h-11 w-11 shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Import from Google Cloud partner directory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste your{" "}
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-secondary">
              cloud.google.com/find-a-partner/partner/…
            </code>{" "}
            URL — we&apos;ll read the listing and fill in your profile. Takes
            about half a minute.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://cloud.google.com/find-a-partner/partner/sada"
          disabled={loading}
          className="h-11 font-mono text-xs"
        />
        <Button
          onClick={runImport}
          disabled={loading || !url.trim()}
          className="h-11 px-5 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Reading page…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Import
            </>
          )}
        </Button>
      </div>

      {preview && (
        <div className="animate-in space-y-4 rounded-xl border border-border bg-card p-5 fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {preview.name || "Untitled partner"}
              </div>
              {preview.tagline && (
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {preview.tagline}
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={apply}
              className="shrink-0 h-9 px-4"
            >
              <Check className="h-4 w-4" /> Apply to profile
            </Button>
          </div>

          {preview.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              {preview.description}
            </p>
          )}

          {/* Strength headline stats */}
          <StrengthStats preview={preview} />

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <KV label="Headquarters" value={preview.headquarters} />
            <KV label="Team size" value={preview.teamSize} />
            <KV label="Industry" value={preview.industry} />
            <KV label="Website" value={preview.website} />
            <KV label="Google Cloud tier" value={preview.gcpTier} />
            <KV label="Partner since" value={preview.partnerSince} />
          </div>

          {(preview.differentiators?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Strengths & differentiators
              </div>
              <ul className="space-y-1">
                {preview.differentiators!.map((d, i) => (
                  <li
                    key={i}
                    className="text-xs text-foreground flex gap-2"
                  >
                    <span className="text-primary mt-0.5">●</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(preview.certifications?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Certifications
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.certifications!.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[11px]">
                    {c.count ? `${c.count}× ` : ""}
                    {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(preview.specializations?.length ?? 0) > 0 && (
            <TagRow title="Specializations" tags={preview.specializations!} />
          )}
          {(preview.expertiseAreas?.length ?? 0) > 0 && (
            <TagRow title="Expertise" tags={preview.expertiseAreas!} />
          )}
          {(preview.industryExperience?.length ?? 0) > 0 && (
            <TagRow title="Industries served" tags={preview.industryExperience!} />
          )}
          {(preview.serviceModels?.length ?? 0) > 0 && (
            <TagRow title="Service models" tags={preview.serviceModels!} />
          )}
          {(preview.officeLocations?.length ?? 0) > 0 && (
            <TagRow title="Offices" tags={preview.officeLocations!} />
          )}
          {(preview.keyClients?.length ?? 0) > 0 && (
            <TagRow title="Key clients" tags={preview.keyClients!} />
          )}

          {(preview.caseStudies?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Case studies ({preview.caseStudies!.length})
              </div>
              <div className="space-y-2">
                {preview.caseStudies!.slice(0, 6).map((cs, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xs font-semibold text-foreground">
                        {cs.title}
                      </div>
                      {cs.client && (
                        <Badge variant="outline" className="text-[10px]">
                          {cs.client}
                        </Badge>
                      )}
                      {cs.industry && (
                        <span className="text-[10px] text-muted-foreground">
                          {cs.industry}
                        </span>
                      )}
                    </div>
                    {cs.summary && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {cs.summary}
                      </p>
                    )}
                    {cs.outcome && (
                      <p className="text-[11px] text-success mt-1 font-medium">
                        → {cs.outcome}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StrengthStats({ preview }: { preview: Extracted }) {
  const certTotal =
    preview.certifications?.reduce((acc, c) => acc + (c.count || 0), 0) ?? 0;
  const tiles: { value: string; label: string }[] = [];
  if (preview.specializations?.length)
    tiles.push({
      value: String(preview.specializations.length),
      label: "Specializations",
    });
  if (certTotal > 0)
    tiles.push({ value: `${certTotal}+`, label: "Certified engineers" });
  if (preview.caseStudies?.length)
    tiles.push({
      value: String(preview.caseStudies.length),
      label: "Case studies",
    });
  if (preview.industryExperience?.length)
    tiles.push({
      value: String(preview.industryExperience.length),
      label: "Industries served",
    });
  if (preview.keyClients?.length)
    tiles.push({
      value: String(preview.keyClients.length),
      label: "Named clients",
    });

  if (tiles.length === 0) return null;

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.slice(0, 5).map((t, i) => (
        <div
          key={i}
          className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5"
        >
          <div className="text-lg font-bold text-primary leading-none">
            {t.value}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function KV({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
        {label}
      </div>
      <div className="text-foreground truncate">{value?.trim() || "—"}</div>
    </div>
  );
}

function TagRow({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[11px]">
            {t}
          </Badge>
        ))}
      </div>
    </div>
  );
}
