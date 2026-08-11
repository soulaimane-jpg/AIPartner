import type {
  ProjectBriefRow as ProjectBrief,
  PartnerProfileRow as PartnerProfile,
  CompanyRow as Company,
} from "@/lib/db/rows";
import { safeJsonParse } from "@/lib/utils";

/**
 * Compute a 0–100 match score between a brief and a partner.
 *
 * Weights:
 *   • Specialization overlap    50%
 *   • Services/expertise overlap 25%
 *   • Industry experience       15%
 *   • Region fit                10%
 *
 * Each sub-score uses a normalized Jaccard-style overlap over lowercased,
 * trimmed tags. The function is deterministic and dependency-free so it
 * can run in a Server Component.
 */

export type MatchInputs = {
  brief: Pick<
    ProjectBrief,
    "services" | "requiredCertifications" | "industryExperience" | "preferredLocation"
  > & { executiveSummary?: string | null };
  partner: Company & { partnerProfile: PartnerProfile | null };
};

export type MatchBreakdown = {
  score: number; // 0–100
  label: "Excellent" | "Strong" | "Fair" | "Weak" | "Poor";
  reasons: string[];
  components: {
    specializations: { score: number; matched: string[]; missing: string[] };
    expertise: { score: number; matched: string[] };
    industry: { score: number; matched: string[] };
    region: { score: number; matched: string[] };
  };
};

export function computeMatch({ brief, partner }: MatchInputs): MatchBreakdown {
  const needs = {
    services: norm(safeJsonParse<string[]>(brief.services, [])),
    industries: norm(
      safeJsonParse<string[]>(brief.industryExperience, []),
    ),
    region: normSingle(brief.preferredLocation ?? ""),
  };

  const pp = partner.partnerProfile;
  const has = {
    specializations: norm(
      safeJsonParse<string[]>(pp?.specializations ?? "[]", []),
    ),
    expertise: norm(
      safeJsonParse<string[]>(pp?.expertiseAreas ?? "[]", []),
    ),
    industry: normSingle(pp?.industry ?? ""),
    industryExperience: norm(
      safeJsonParse<string[]>(pp?.industryExperience ?? "[]", []),
    ),
    regions: norm(safeJsonParse<string[]>(pp?.regions ?? "[]", [])),
    caseStudyIndustries: norm(
      safeJsonParse<{ industry?: string }[]>(pp?.caseStudies ?? "[]", [])
        .map((c) => c?.industry || "")
        .filter(Boolean),
    ),
  };

  // Specializations vs. brief's requested services (this is the strongest signal).
  const specHits = intersect(needs.services, has.specializations);
  const specMissing = needs.services.filter(
    (s) => !has.specializations.includes(s),
  );
  const specScore = needs.services.length
    ? (specHits.length / needs.services.length) * 100
    : has.specializations.length
      ? 60
      : 0;

  // Expertise: do any partner tools map to the brief's services/summary?
  const summaryHay = (brief.executiveSummary ?? "").toLowerCase();
  const expertiseHits = has.expertise.filter(
    (e) =>
      summaryHay.includes(e) ||
      needs.services.some((s) => s.includes(e) || e.includes(s)),
  );
  const expertiseScore = has.expertise.length
    ? Math.min(100, (expertiseHits.length / has.expertise.length) * 100 + 30)
    : 0;

  // Industry fit: combine partner's industryExperience, primary industry,
  // and industries they've actually delivered case studies in.
  const partnerIndustries = new Set<string>([
    ...has.industryExperience,
    ...has.caseStudyIndustries,
    ...(has.industry ? [has.industry] : []),
  ]);
  const industryHits = needs.industries.filter((i) =>
    Array.from(partnerIndustries).some(
      (pi) => pi.includes(i) || i.includes(pi),
    ),
  );
  const industryScore = needs.industries.length
    ? (industryHits.length / needs.industries.length) * 100
    : partnerIndustries.size > 0
      ? 50
      : 0;

  // Region fit: simple substring/overlap match
  const regionHits = has.regions.filter((r) =>
    needs.region ? needs.region.includes(r) || r.includes(needs.region) : false,
  );
  const regionScore = needs.region
    ? regionHits.length > 0
      ? 100
      : 30
    : 50;

  const score = Math.round(
    specScore * 0.5 + expertiseScore * 0.25 + industryScore * 0.15 + regionScore * 0.1,
  );

  const reasons: string[] = [];
  if (specHits.length)
    reasons.push(
      `Specialized in ${specHits.slice(0, 3).join(", ")}${specHits.length > 3 ? "…" : ""}`,
    );
  if (specMissing.length)
    reasons.push(
      `Missing: ${specMissing.slice(0, 2).join(", ")}${specMissing.length > 2 ? "…" : ""}`,
    );
  if (expertiseHits.length)
    reasons.push(`Tool expertise: ${expertiseHits.slice(0, 3).join(", ")}`);
  if (regionHits.length) reasons.push(`Regional fit`);

  return {
    score,
    label: labelFor(score),
    reasons,
    components: {
      specializations: {
        score: Math.round(specScore),
        matched: specHits,
        missing: specMissing,
      },
      expertise: {
        score: Math.round(expertiseScore),
        matched: expertiseHits,
      },
      industry: {
        score: Math.round(industryScore),
        matched: industryHits,
      },
      region: {
        score: Math.round(regionScore),
        matched: regionHits,
      },
    },
  };
}

function norm(arr: string[]): string[] {
  return arr.filter(Boolean).map((s) => s.trim().toLowerCase());
}

function normSingle(s: string): string {
  return s.trim().toLowerCase();
}

function intersect(a: string[], b: string[]): string[] {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x));
}

function labelFor(score: number): MatchBreakdown["label"] {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 45) return "Fair";
  if (score >= 25) return "Weak";
  return "Poor";
}
