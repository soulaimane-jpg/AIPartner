import type { ProjectBriefRow } from "@/lib/db/rows";

type ServiceCode = "RESELLING" | "CONSULTING" | "MANAGED" | "SUPPORT" | "TRAINING";

/**
 * Per-engagement-type guidance so the assistant asks questions that fit
 * the exact problem the customer picked in the brief router, instead of a
 * generic script. Keyed by the ServiceCategory codes stored on the brief.
 */
const SERVICE_PLAYBOOK: Record<ServiceCode, { label: string; focus: string }> = {
  RESELLING: {
    label: "Reselling & Commercial Optimization",
    focus:
      "effective spend and billing structure, volume commitments and credits, discount tiers, invoicing consolidation, contract flexibility and renewal timing, and the level of partner-led account support wanted",
  },
  CONSULTING: {
    label: "Consulting & Project Delivery",
    focus:
      "the target business outcome and why now, the architecture and GCP services involved, the workloads to build or migrate, data sources and integrations, security and compliance constraints, migration/cutover approach, acceptance criteria, timeline and milestones, and team responsibilities",
  },
  MANAGED: {
    label: "Managed Services (Ongoing Ops)",
    focus:
      "which environments and workloads need day-to-day operation, required SLAs/SLOs, coverage hours (business vs 24/7), monitoring and alerting scope, incident response and resolution targets by severity, patching/backup/DR expectations, on-call and escalation, existing runbooks and tooling, and compliance obligations",
  },
  SUPPORT: {
    label: "Reactive Support",
    focus:
      "the support tiers needed (L1\u2013L4), how incident severities are defined, expected response and resolution targets, coverage hours and time zones, escalation paths, ticketing tooling, which GCP products and workloads are in scope, and rough ticket volume",
  },
  TRAINING: {
    label: "Training & Enablement",
    focus:
      "the audience and team size, current skill level, target GCP certifications or skills, priority topics, delivery format (hands-on labs, workshops, remote vs onsite), preferred schedule and duration, and how success will be measured",
  },
};

/**
 * The structured-output contract appended to EVERY brief prompt.
 *
 * `/api/chat` parses `<answer_rating>` and `<brief_update>` out of each reply
 * (`parseAnswerRating` / `parseBriefUpdate`) and writes the patch onto the
 * ProjectBrief. Without these instructions the model emits neither block, so
 * `applyBriefPatch` receives an empty patch and the Overview/SoW never fills
 * in no matter how much the customer types. Keep the tag names in sync with
 * `@/lib/claude`.
 */
export const BRIEF_EXTRACTION_CONTRACT = `

# TENANT ISOLATION (ABSOLUTE)
This is a multi-tenant product. Everything you have been given belongs to ONE
customer, and you must behave as if no other customer exists:
- Never mention, imply, compare against, or infer the existence of any other
  customer, company, brief, partner engagement, or deal — named or anonymous.
- Never repeat figures, names, architectures or terms that did not come from
  THIS conversation or THIS brief's own context above.
- If asked what other customers do, what typical pricing/discounts others got,
  or anything requiring another tenant's data, say you can only work from this
  project's information and continue with the next question.
- Illustrative examples must be clearly generic and hypothetical, never
  presented as another client's real data.

# STRUCTURED EXTRACTION (CRITICAL — NEVER SKIP)
At the END of every reply, on new lines, output BOTH of these blocks in this exact order:

<answer_rating>{"score": 0-100, "strengths": ["..."], "suggestion": "..."}</answer_rating>
<brief_update>{...}</brief_update>

## <answer_rating> — rate the user's latest message
- score: 0 (vague / off-topic) to 100 (specific, actionable, quantified)
- strengths: 0-3 short bullets on what was good ("quantified user count", "named the exact GCP service")
- suggestion: one concrete sentence on what would make the answer stronger ("" when score >= 90)
Reward concrete numbers, named systems and explicit constraints. Be encouraging but honest.

## <brief_update> — extraction patch
Include ONLY fields you can confidently derive from the conversation so far. Omit anything you'd be guessing at. Never invent values. Valid keys:

Text fields:
- title (3-8 words, human-readable project name)
- executiveSummary (2-4 sentences: the problem plus the desired outcome)
- targetGoLive (e.g. "Q2 2026", "Sep 2026")
- budgetRange (e.g. "$150k-$250k USD")
- preferredLocation (e.g. "EMEA, data in Netherlands")
- procurementType (one of: "DIRECT_GOOGLE", "VIA_RESELLER", "UNSURE")

Array fields:
- scopeRequirements: [{title, detail}] — concrete capabilities, deliverables, SLAs or training topics
- dataSources: [{name, detail}] — databases, files, streams, SaaS sources
- integrationPoints: [{title, detail}] — systems to connect to
- successCriteria: [{metric, target}] — measurable KPIs
- customerRoles: [string] — who will use the solution
- milestones: [{title, date}] — key dates or phases
- requiredCertifications: [string] — e.g. ["ISO 27001", "SOC2"]
- industryExperience: [string] — verticals
- decisionMakers: [string] — titles who sign off
- selectionCriteria: [string] — what the customer values in a partner
- services: [string] — from: "Data Analytics", "Machine Learning", "Cloud Migration", "Generative AI", "App Modernization", "Security", "SAP", "DevOps", "Networking", "Data Lake", "Work Transformation"

Both blocks are stripped before the user sees your reply, so they never disrupt the conversation. If you extracted nothing new this turn, still emit both — use <brief_update>{}</brief_update>.

Map every engagement type onto these same keys: for managed services or support, put SLAs, coverage hours and severity targets in scopeRequirements and successCriteria; for training, put audience and topics in customerRoles and scopeRequirements; for commercial work, put commitments and contract needs in scopeRequirements and selectionCriteria.`;

export function buildBriefSystemPrompt(brief: ProjectBriefRow): string {
  const services = parseServices(brief.services);
  const base =
    brief.intentRoute === "COMMERCIAL"
      ? buildCommercialPrompt(brief, services)
      : buildTechnicalPrompt(brief, services);
  return base + BRIEF_EXTRACTION_CONTRACT;
}

/**
 * The first assistant message shown when a brief is created, tailored to
 * the primary engagement type so the conversation opens on-topic.
 */
export function buildOpeningMessage(
  rawServices: string[] | string,
  intentRoute: string,
): string {
  if (intentRoute === "COMMERCIAL") {
    return "Let\u2019s optimize your commercial position. What outcome matters most: lower effective spend, improved contract flexibility, consolidated billing, or partner-led account support?";
  }
  const services = Array.isArray(rawServices)
    ? rawServices.filter((s): s is ServiceCode => s in SERVICE_PLAYBOOK)
    : parseServices(rawServices);
  const primary = services.find((s) => s !== "RESELLING");
  switch (primary) {
    case "MANAGED":
      return "Let\u2019s scope your managed services engagement. Which environments or workloads need day-to-day operation, and what uptime or SLA matters most?";
    case "SUPPORT":
      return "Let\u2019s define your support needs. What kinds of incidents do you need help with, and how fast do they need a response?";
    case "TRAINING":
      return "Let\u2019s plan your enablement. Who on your team needs upskilling, and which GCP skills or certifications are the priority?";
    case "CONSULTING":
    default:
      return "Let\u2019s shape your delivery brief. What business outcome must this project achieve, and why is it important now?";
  }
}

export function buildCommercialPrompt(
  brief: ProjectBriefRow,
  services: ServiceCode[] = parseServices(brief.services),
): string {
  const context = parseContext(brief.cloudContextSnapshot);
  return `You are the commercial AI Partner brief builder. Help the customer define a partner-ready commercial engagement for Google Cloud reselling, billing, discounts, credits, contract flexibility, renewals, and account support.

Ask exactly one concise question at a time. Never invent discounts, commitments, savings, funding, or response promises. Use only this immutable company context when relevant:
${JSON.stringify({
    providers: context.providers ?? [], resellerStatus: context.resellerStatus ?? null,
    agreementStatus: context.agreementStatus ?? null, agreementEndDate: context.agreementEndDate ?? null,
    minimumCommitmentUsd: context.minimumCommitmentUsd ?? null, discountPct: context.discountPct ?? null,
    renewalWindow: context.renewalWindow ?? false,
  })}

Selected services: ${brief.services}. Delivery model: ${brief.deliveryModel}. Keep technical implementation detail secondary unless needed to qualify a commercial requirement.${focusBlock(services)}`;
}

export function buildTechnicalPrompt(
  brief: ProjectBriefRow,
  services: ServiceCode[] = parseServices(brief.services),
): string {
  return `You are the technical AI Partner brief builder. Help the customer define a partner-ready delivery engagement covering business outcome, architecture, scope, workloads, data, integrations, security, migration, operations, acceptance criteria, timeline, and team responsibilities.

Ask exactly one concise question at a time. Never mention or infer company spend, discounts, commitments, billing, reseller relationships, or contract terms. Selected services: ${brief.services}. Delivery model: ${brief.deliveryModel}. Target start: ${brief.targetGoLive ?? "unknown"}. Estimated budget: ${brief.budgetRange ?? "unknown"}.${focusBlock(services)}`;
}

/**
 * Builds an explicit "focus your questions here" block from the selected
 * engagement types. RESELLING is omitted because it's already the entire
 * commercial script — this only surfaces the delivery-side specialisations.
 */
function focusBlock(services: ServiceCode[]): string {
  const relevant = services.filter((s) => s !== "RESELLING");
  if (relevant.length === 0) return "";
  const lines = relevant.map(
    (s) => `- ${SERVICE_PLAYBOOK[s].label}: prioritise ${SERVICE_PLAYBOOK[s].focus}.`,
  );
  const intro =
    relevant.length === 1
      ? `\n\nThis brief is specifically about ${SERVICE_PLAYBOOK[relevant[0]].label}. Tailor every question to it and don't drift into unrelated topics:`
      : `\n\nThe customer selected multiple engagement types. Cover each one's specifics and don't drift into unrelated topics:`;
  return `${intro}\n${lines.join("\n")}`;
}

function parseServices(raw: string): ServiceCode[] {
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) {
      return value.filter(
        (s): s is ServiceCode => typeof s === "string" && s in SERVICE_PLAYBOOK,
      );
    }
  } catch {
    /* fall through to empty */
  }
  return [];
}

function parseContext(raw: string): Record<string, unknown> {
  try { const value = JSON.parse(raw); return value && typeof value === "object" ? value : {}; } catch { return {}; }
}
