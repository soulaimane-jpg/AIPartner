import { safeJsonParse } from "@/lib/utils";
import { STAGE_ORDER } from "@/lib/constants";
import type { BriefStage } from "@/lib/enums";

export type BriefLike = {
  executiveSummary?: string | null;
  scopeRequirements?: string | null;
  dataSources?: string | null;
  integrationPoints?: string | null;
  successCriteria?: string | null;
  customerRoles?: string | null;
  targetGoLive?: string | null;
  milestones?: string | null;
  budgetRange?: string | null;
  preferredLocation?: string | null;
  requiredCertifications?: string | null;
  industryExperience?: string | null;
  procurementType?: string | null;
  decisionMakers?: string | null;
  selectionCriteria?: string | null;
  services?: string | null;
};

const textFilled = (v?: string | null) => !!(v && v.trim().length > 0);
const arrFilled = (v?: string | null) =>
  safeJsonParse<unknown[]>(v ?? "[]", []).length > 0;

/**
 * Six-section weighted completion breakdown.
 * Each section has a weight (points) and a list of signals. We award a section
 * its points if at least one of its required signals is present; partial
 * credit for partially-filled sections is possible when some but not all
 * signals are met.
 *
 * The Claude scoping prompt is kept in sync with this so 100% is reachable
 * through the chat alone.
 */
export type CompletionSection = {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..weight
  filled: string[]; // human labels of signals satisfied
  missing: string[]; // human labels of signals still needed
};

export function computeCompletionBreakdown(b: BriefLike): {
  total: number; // 0..100
  sections: CompletionSection[];
} {
  const spec: {
    key: string;
    label: string;
    weight: number;
    signals: { label: string; ok: boolean }[];
  }[] = [
    {
      key: "business",
      label: "Business context",
      weight: 20,
      signals: [
        { label: "Executive summary of the problem", ok: textFilled(b.executiveSummary) },
        { label: "Success criteria / KPIs", ok: arrFilled(b.successCriteria) },
      ],
    },
    {
      key: "scope",
      label: "Technical scope",
      weight: 25,
      signals: [
        { label: "Scope requirements / deliverables", ok: arrFilled(b.scopeRequirements) },
        { label: "Data sources", ok: arrFilled(b.dataSources) },
        { label: "Integration points", ok: arrFilled(b.integrationPoints) },
        { label: "Service capabilities selected", ok: arrFilled(b.services) },
      ],
    },
    {
      key: "timing",
      label: "Timing & milestones",
      weight: 15,
      signals: [
        { label: "Target go-live date", ok: textFilled(b.targetGoLive) },
        { label: "Key milestones", ok: arrFilled(b.milestones) },
      ],
    },
    {
      key: "constraints",
      label: "Constraints & compliance",
      weight: 15,
      signals: [
        { label: "Budget range", ok: textFilled(b.budgetRange) },
        { label: "Preferred region / data residency", ok: textFilled(b.preferredLocation) },
        {
          label: "Compliance or industry experience needs",
          ok: arrFilled(b.requiredCertifications) || arrFilled(b.industryExperience),
        },
      ],
    },
    {
      key: "stakeholders",
      label: "Stakeholders & selection",
      weight: 15,
      signals: [
        { label: "Customer roles who will use it", ok: arrFilled(b.customerRoles) },
        { label: "Decision makers", ok: arrFilled(b.decisionMakers) },
        { label: "Partner selection criteria", ok: arrFilled(b.selectionCriteria) },
      ],
    },
    {
      key: "procurement",
      label: "Procurement",
      weight: 10,
      signals: [
        { label: "Procurement path (direct / reseller / unsure)", ok: textFilled(b.procurementType) },
      ],
    },
  ];

  const sections: CompletionSection[] = spec.map((s) => {
    const filled = s.signals.filter((x) => x.ok).map((x) => x.label);
    const missing = s.signals.filter((x) => !x.ok).map((x) => x.label);
    const ratio = s.signals.length ? filled.length / s.signals.length : 0;
    const score = Math.round(s.weight * ratio);
    return {
      key: s.key,
      label: s.label,
      weight: s.weight,
      score,
      filled,
      missing,
    };
  });

  const total = Math.min(100, sections.reduce((a, s) => a + s.score, 0));
  return { total, sections };
}

/** Backwards-compatible numeric completion. */
export function computeCompletion(b: BriefLike): number {
  return computeCompletionBreakdown(b).total;
}

/**
 * Minimum completion required to submit a brief to triage.
 *
 * Single source of truth: the preview page disables the button on this
 * value and `submitBriefAction` rejects on it. Previously only the UI
 * enforced it, so a direct Server Action call could push a 0% brief
 * into the admin queue.
 */
export const MIN_SUBMIT_COMPLETION = 40;

export function stageIndex(stage: BriefStage): number {
  const idx = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return idx === -1 ? 0 : idx;
}

export function getBriefStage(stage: string): BriefStage {
  return (stage as BriefStage) ?? "INTAKE";
}
