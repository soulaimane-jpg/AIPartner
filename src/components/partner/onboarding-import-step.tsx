"use client";

/**
 * Step 0 of onboarding: populate the profile from a public source.
 *
 * Two accepted inputs — the partner's Google Cloud listing or their own
 * website. Both funnel through `/api/partner/import`, then extracted labels are
 * resolved to canonical tag ids by `/api/partner/import/map-tags`.
 *
 * Nothing is persisted here. The patch is handed to the wizard, which holds it
 * in state until the partner saves a step. That is what makes the "you can edit
 * everything before anything is saved" promise literally true.
 */

import { useState } from "react";
import { Globe, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PILLAR_FIELDS } from "@/lib/partner-pillars";
import type { PillarValues } from "@/lib/partner-pillar-values";

export interface ImportedPillarPatch {
  values: PillarValues;
  tagLabels: Record<string, string>;
  /** field key → "directory" | "website", for the provenance chips. */
  provenance: Record<string, string>;
}

/** Facet ← extraction field, for the tag-resolution round-trip. */
const FACET_SOURCES: { facet: string; fieldKey: string; from: string[] }[] = [
  { facet: "specialization", fieldKey: "specializations", from: ["specializations"] },
  { facet: "workload", fieldKey: "workloads", from: ["workloads"] },
  { facet: "vertical", fieldKey: "verticals", from: ["industryExperience"] },
  { facet: "compliance", fieldKey: "compliance", from: ["compliance"] },
  { facet: "product", fieldKey: "products", from: ["expertiseAreas"] },
  { facet: "platform", fieldKey: "platforms", from: ["clouds", "platforms"] },
];

interface ExtractedShape {
  specializations?: string[];
  workloads?: string[];
  industryExperience?: string[];
  compliance?: string[];
  expertiseAreas?: string[];
  platforms?: string[];
  clouds?: string[];
  engagementModels?: string[];
  resellPlatforms?: string;
  ipAssets?: { name?: string; description?: string; timeSaved?: string }[];
  caseStudies?: {
    title?: string;
    client?: string;
    industry?: string;
    summary?: string;
    outcome?: string;
    link?: string;
  }[];
}

const ENGAGEMENT_VALUES = new Set([
  "time_materials",
  "fixed_price",
  "outcome",
  "gain_share",
  "retainer",
]);

export function ImportStep({
  directoryUrl,
  website,
  onApply,
  onSkip,
}: {
  directoryUrl: string;
  website: string;
  onApply: (patch: ImportedPillarPatch) => void;
  onSkip: () => void;
}) {
  const [url, setUrl] = useState(directoryUrl || website || "");
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const run = async () => {
    if (!url.trim()) {
      toast.error("Paste a link first");
      return;
    }
    setBusy(true);
    setUnmatched([]);
    try {
      const res = await fetch("/api/partner/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not read that link");
        return;
      }

      const data = (json.data ?? {}) as ExtractedShape;
      const sourceKind: string = json.sourceKind ?? "website";

      // Collect the label strings per facet, then resolve them in one call.
      const labelsByFacet: Record<string, string[]> = {};
      for (const spec of FACET_SOURCES) {
        const labels = spec.from.flatMap(
          (key) => (data[key as keyof ExtractedShape] as string[]) ?? [],
        );
        if (labels.length > 0) labelsByFacet[spec.facet] = labels;
      }

      let matched: Record<string, { id: string; label: string }[]> = {};
      let missed: Record<string, string[]> = {};
      if (Object.keys(labelsByFacet).length > 0) {
        const mapRes = await fetch("/api/partner/import/map-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelsByFacet }),
        });
        const mapJson = await mapRes.json();
        if (mapRes.ok && mapJson.ok) {
          matched = mapJson.matched ?? {};
          missed = mapJson.unmatched ?? {};
        }
      }

      const values: PillarValues = {};
      const tagLabels: Record<string, string> = {};
      const provenance: Record<string, string> = {};

      // Labels dropped because a field was already at its cap. Reported for
      // the same reason unmatched ones are: a partner who can see what was
      // left out can add it deliberately.
      const overflow: string[] = [];

      for (const spec of FACET_SOURCES) {
        const hits = matched[spec.facet] ?? [];
        if (hits.length === 0) continue;

        // Respect the field's own cap. `savePillarStepAction` validates against
        // the same maxSelections, so handing the wizard more than the limit
        // produces a step that can never be saved — Continue just fails, which
        // reads as a dead button.
        const cap = PILLAR_FIELDS[spec.fieldKey]?.maxSelections;
        const kept = typeof cap === "number" ? hits.slice(0, cap) : hits;
        if (kept.length < hits.length) {
          overflow.push(...hits.slice(kept.length).map((h) => h.label));
        }

        values[spec.fieldKey] = kept.map((h) => h.id);
        for (const h of kept) tagLabels[h.id] = h.label;
        provenance[spec.fieldKey] = sourceKind;
      }

      // Engagement models are a closed set; drop anything the model invented.
      const models = (data.engagementModels ?? []).filter((m) =>
        ENGAGEMENT_VALUES.has(m),
      );
      if (models.length > 0) {
        values.engagementModels = models.slice(0, 3);
        provenance.engagementModels = sourceKind;
      }

      if (data.resellPlatforms) {
        values.resellPlatforms = String(data.resellPlatforms).slice(0, 300);
        provenance.resellPlatforms = sourceKind;
      }

      const assets = (data.ipAssets ?? []).filter((a) => a?.name);
      if (assets.length > 0) {
        values.ipAssets = assets.map((a) => ({
          name: String(a.name ?? "").slice(0, 120),
          category: "",
          description: String(a.description ?? "").slice(0, 300),
          access: "",
          impact: "",
          timeSaved: String(a.timeSaved ?? "").slice(0, 120),
        }));
        provenance.ipAssets = sourceKind;
      }

      const studies = (data.caseStudies ?? []).filter((c) => c?.title);
      if (studies.length > 0) {
        values.caseStudies = studies.map((c) => ({
          title: String(c.title ?? ""),
          client: String(c.client ?? ""),
          industry: String(c.industry ?? ""),
          summary: String(c.summary ?? ""),
          outcome: String(c.outcome ?? ""),
          link: String(c.link ?? ""),
          // Never guessed. A fabricated engagement date would be worse than
          // an absent one, since recency is exactly what buyers weigh.
          engagementDate: "",
          referenceAvailable: false,
          confidential: false,
        }));
        provenance.caseStudies = sourceKind;
      }

      const allMissed = Object.values(missed).flat();
      setUnmatched(allMissed.slice(0, 12));

      const filled = Object.keys(values).length;
      if (filled === 0) {
        toast.warning("We couldn't find anything structured on that page.");
        return;
      }

      onApply({ values, tagLabels, provenance });
      setDone(sourceKind);
      // Trimmed tags are in the library, they just did not fit the field's
      // limit — saying so is the difference between "we ignored your data" and
      // "pick the ones that matter".
      toast.success(
        `Pre-filled ${filled} section${filled === 1 ? "" : "s"}`,
        overflow.length > 0
          ? {
              description: `${overflow.length} more went over a field's limit and weren't added: ${overflow.slice(0, 4).join(", ")}${overflow.length > 4 ? "…" : ""}`,
            }
          : undefined,
      );
    } catch {
      toast.error("Import failed — you can still fill things in by hand.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-line bg-card shadow-elev-1">
        <CardContent className="space-y-5 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <Globe className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-semibold text-foreground">
                Your Google Cloud listing or your website
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                We read what is publicly on the page — nothing private, nothing
                invented. Everything lands as a draft for you to correct.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[12px] text-muted-foreground">
              Link to import from
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void run();
                }}
                placeholder="https://cloud.google.com/find-a-partner/partner/… or https://yourcompany.com"
                className="h-11 rounded-xl bg-card text-[13px]"
              />
              <Button
                onClick={run}
                disabled={busy}
                className="h-11 shrink-0 px-6 font-semibold"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy ? "Reading…" : "Import"}
              </Button>
            </div>
          </div>

          {done && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-[12.5px] font-medium text-emerald-900">
                Imported from your{" "}
                {done === "directory" ? "Google Cloud listing" : "website"}.
                Check each step and correct anything that looks off.
              </p>
            </div>
          )}

          {unmatched.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="text-[12.5px] font-medium text-amber-950">
                    We found these but they are not in our library yet
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                    {unmatched.join(", ")}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-amber-700">
                    Add any that matter using &ldquo;Suggest&rdquo; in the
                    relevant step.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={onSkip}
        className="text-[12.5px] text-muted-foreground underline-offset-2 hover:underline"
      >
        Skip — I&apos;ll fill it in myself
      </button>
    </div>
  );
}
