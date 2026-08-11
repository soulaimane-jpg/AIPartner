/**
 * Curated brief-template catalogue.
 *
 * Each entry maps to a `BriefTemplate` row (seeded by
 * `seedBriefTemplates()`), but the canonical list lives in code so it
 * ships with the deploy. The DB stores them for tooling (admin UI,
 * analytics, A/B tests) — never as the source of truth for shape.
 *
 * Adding a template: append below, bump `BRIEF_TEMPLATE_VERSION`, run
 * `seedBriefTemplates()` (idempotent upsert).
 */

import "server-only";
import { insertRow } from "@/lib/db";

export const BRIEF_TEMPLATE_VERSION = 1;

/** Icon keys allowed in the template picker — keeps RSC props serialisable. */
export const BRIEF_TEMPLATE_ICONS = [
  "sparkles",
  "database",
  "brain",
  "shield",
  "cloud",
  "bar-chart-3",
  "workflow",
  "messages-square",
  "gauge",
  "rocket",
  "lock",
  "users",
] as const;
export type BriefTemplateIcon = (typeof BRIEF_TEMPLATE_ICONS)[number];

/** Shape we accept inside `BriefTemplate.body`. Validated at apply-time. */
export interface BriefTemplateBody {
  title: string;
  executiveSummary?: string;
  scopeRequirements?: string;
  integrationPoints?: string;
  dataSources?: string;
  successCriteria?: string;
  targetGoLive?: string;
  budgetRange?: string;
  preferredLocation?: string;
  requiredCertifications?: string;
  /** First message the copilot will replay to nudge the user. */
  copilotOpener: string;
}

export interface BriefTemplateCatalogueEntry {
  slug: string;
  title: string;
  tagline: string;
  industry?: string;
  icon: BriefTemplateIcon;
  rank: number;
  body: BriefTemplateBody;
}

export const BRIEF_TEMPLATES: BriefTemplateCatalogueEntry[] = [
  {
    slug: "bigquery-migration",
    title: "Data warehouse → BigQuery migration",
    tagline: "Move Snowflake / Redshift / Synapse workloads onto BigQuery with minimal downtime.",
    industry: "any",
    icon: "database",
    rank: 10,
    body: {
      title: "BigQuery migration",
      executiveSummary:
        "We are migrating our analytical data warehouse onto BigQuery. The goal is to reduce platform cost, unify analytics on GCP, and enable team-wide self-service. We expect minimal downtime on critical dashboards.",
      scopeRequirements:
        "Discovery of all existing pipelines, schema translation, DDL rebuild in BigQuery, dual-running until cutover, BI tool repointing.",
      dataSources: "Existing warehouse, transactional databases, third-party SaaS connectors.",
      successCriteria:
        "All P0 dashboards running on BigQuery with parity, dbt rebuilt, query cost ≤ 60% of today's spend.",
      copilotOpener:
        "Great — let's scope your BigQuery migration. First, which warehouse are you moving away from, and roughly how many TB of data are in scope?",
    },
  },
  {
    slug: "vertex-ai-poc",
    title: "Vertex AI proof-of-concept",
    tagline: "Stand up a production-grade Vertex AI prototype for a single business use case.",
    industry: "any",
    icon: "brain",
    rank: 20,
    body: {
      title: "Vertex AI POC",
      executiveSummary:
        "We want a 6-8 week proof of concept on Vertex AI that demonstrates measurable lift on a defined business problem and gives us a clear production path.",
      scopeRequirements:
        "Use-case framing, data prep, baseline model, fine-tune or RAG approach, evaluation harness, demo UI, runbook for handover.",
      successCriteria:
        "Quantified lift vs. baseline, signed-off evaluation report, decision on production rollout.",
      copilotOpener:
        "Excellent — Vertex AI POCs work best when the use case is sharply defined. What's the single business problem you want to prove out?",
    },
  },
  {
    slug: "genai-launch",
    title: "GenAI customer-facing launch",
    tagline: "Ship a customer-facing GenAI feature on GCP with safety, eval and observability baked in.",
    industry: "any",
    icon: "sparkles",
    rank: 30,
    body: {
      title: "GenAI customer-facing launch",
      executiveSummary:
        "We need to launch a customer-facing GenAI experience grounded in our content. Reliability, latency, safety, and cost predictability are non-negotiable.",
      scopeRequirements:
        "Retrieval pipeline, model selection, safety filters, eval harness, SLO design, observability, A/B framework, rollout plan.",
      successCriteria:
        "P95 latency, deflection rate, CSAT delta vs. control, cost per session within target, incident-free 30-day stabilisation.",
      copilotOpener:
        "Love this. To scope a GenAI launch we need to align on the user, the task, the safety posture, and your latency budget — let's start with the user-facing job-to-be-done.",
    },
  },
  {
    slug: "data-lake-modernisation",
    title: "Data lake modernisation on GCS + BigLake",
    tagline: "Refactor a sprawling lake into Cloud Storage + BigLake with governance and lineage.",
    icon: "cloud",
    rank: 40,
    body: {
      title: "Data lake modernisation",
      executiveSummary:
        "Our data lake has sprawled across teams and accounts. We need a unified GCS + BigLake architecture with discoverable, governed datasets.",
      scopeRequirements:
        "Catalog & lineage (Dataplex), tiered storage policy, IAM redesign, dataset-product framework, migration roadmap.",
      successCriteria:
        "All P0 datasets registered, lineage captured, ≥ 80% reduction in unsanctioned datasets within 90 days.",
      copilotOpener:
        "Modernising a sprawling lake — got it. To scope this well I need to understand the team topology first: how many data-producing teams, and how is access managed today?",
    },
  },
  {
    slug: "cloud-cost-optimisation",
    title: "Cloud cost optimisation programme",
    tagline: "12-week programme to reduce GCP spend without compromising delivery velocity.",
    icon: "gauge",
    rank: 50,
    body: {
      title: "GCP cost optimisation programme",
      executiveSummary:
        "We want a structured 12-week programme to identify, prioritise and execute on GCP cost savings — quick wins first, structural changes second.",
      scopeRequirements:
        "Spend assessment, opportunity ledger, FinOps tooling, rightsizing, commitment strategy, dashboards, training.",
      successCriteria:
        "≥ 20% gross savings against today's run-rate, FinOps practice operating monthly with named owners.",
      copilotOpener:
        "Cost programmes pay back fastest when scoped concretely. What's your current monthly GCP spend, and which 2–3 services account for most of it?",
    },
  },
  {
    slug: "security-baseline",
    title: "GCP security baseline & CIS benchmark",
    tagline: "Bring an existing GCP org up to CIS Benchmark + a hardened landing zone.",
    icon: "shield",
    rank: 60,
    body: {
      title: "GCP security baseline",
      executiveSummary:
        "Our existing GCP org has grown organically. We need it brought up to CIS Benchmark, with a landing zone, Org policies, SCC, and a clear path to SOC 2 / ISO alignment.",
      scopeRequirements:
        "Org policy hardening, landing zone refactor, IAM cleanup, SCC + Audit Logs, KMS / VPC-SC, runbook handover.",
      successCriteria:
        "100% CIS pass on production projects, SCC live with paging, audit log retention ≥ 1y, exec sign-off.",
      copilotOpener:
        "Security baselining — got it. To prioritise the work I need to understand where you are today: do you already have a landing zone, an SCC tier, and centralised audit logging?",
    },
  },
  {
    slug: "marketing-analytics",
    title: "Marketing analytics on BigQuery + Looker",
    tagline: "Unified marketing analytics: BigQuery as the source of truth, Looker for everyone.",
    icon: "bar-chart-3",
    rank: 70,
    body: {
      title: "Marketing analytics on BigQuery + Looker",
      executiveSummary:
        "We need one source of truth for marketing performance — ad spend, conversions, CRM, web. The team should self-serve in Looker without IT.",
      scopeRequirements:
        "Source integration (Google Ads, Meta, LinkedIn, CRM, GA4), dbt models, attribution layer, LookML semantic layer, dashboards.",
      successCriteria:
        "All marketing channels in BigQuery within ≤ 24h freshness, 6 named Looker dashboards, marketer NPS on the tool ≥ 30.",
      copilotOpener:
        "Marketing analytics — let's anchor on the questions you want to answer. Which 3 business questions hurt the most today because the data isn't joined up?",
    },
  },
  {
    slug: "sap-on-gcp",
    title: "SAP workload to GCP",
    tagline: "Lift-and-shift or replatform an SAP estate onto Google Cloud with HA + DR.",
    icon: "workflow",
    rank: 80,
    body: {
      title: "SAP on GCP",
      executiveSummary:
        "We are evaluating moving our SAP landscape onto GCP. Goals: cost reduction, HA, DR, and a path to S/4HANA on Bare Metal Solution or Compute Engine.",
      scopeRequirements:
        "Discovery, sizing, network design, HA & DR architecture, OS / DB version uplift, cutover plan.",
      successCriteria:
        "Validated landing-zone design, exec-approved migration roadmap with cost & risk model, signed-off cutover plan.",
      copilotOpener:
        "SAP on GCP — to size this right I need to know your SAP estate: ECC or S/4, on HANA or AnyDB, and roughly the total DB footprint?",
    },
  },
  {
    slug: "workspace-transformation",
    title: "Workspace adoption & change programme",
    tagline: "Migrate Microsoft 365 → Google Workspace and drive measurable adoption.",
    icon: "users",
    rank: 90,
    body: {
      title: "Workspace transformation",
      executiveSummary:
        "We are migrating from Microsoft 365 to Google Workspace. We need a programme that handles migration, identity, change management, and measurable adoption.",
      scopeRequirements:
        "Identity & SSO, mail/file migration, security baseline, training, champion network, adoption dashboard.",
      successCriteria:
        "100% mailbox cutover, ≥ 70% weekly active rate on Drive/Meet within 90 days post-go-live, helpdesk volume normalised.",
      copilotOpener:
        "Workspace migration is as much change-management as IT. How many users are in scope, in how many countries, and what's your existing identity provider?",
    },
  },
  {
    slug: "ml-platform",
    title: "Internal ML platform on Vertex",
    tagline: "Productionise ML at scale with a Vertex-based platform, MLOps, and golden paths.",
    icon: "rocket",
    rank: 100,
    body: {
      title: "Vertex-based ML platform",
      executiveSummary:
        "Our data-science team ships ad-hoc models in notebooks. We need a Vertex-based platform with feature store, model registry, CI/CD, and clear paths to prod.",
      scopeRequirements:
        "Vertex Pipelines, Feature Store, Model Registry, CI/CD, monitoring & drift, on-call & runbook.",
      successCriteria:
        "≥ 3 reference models deployed via golden path, time-to-prod for a new model ≤ 4 weeks, drift alerting live.",
      copilotOpener:
        "Internal ML platforms succeed when the golden path is opinionated. How many ML use-cases do you have in flight today, and how do you deploy them now?",
    },
  },
  {
    slug: "networking-redesign",
    title: "GCP networking redesign",
    tagline: "Shared VPC + hybrid connectivity refactor with security and HA built in.",
    icon: "workflow",
    rank: 110,
    body: {
      title: "GCP networking redesign",
      executiveSummary:
        "Our GCP network has accreted complexity. We want a Shared VPC + hybrid connectivity refactor with strong segmentation, redundancy, and SCC visibility.",
      scopeRequirements:
        "Topology review, IP plan, Shared VPC, Interconnect / VPN HA, FW & SCC integration, runbook.",
      successCriteria:
        "Topology document signed, HA Interconnect live, P95 hybrid latency under target, audit-clean firewall rule-set.",
      copilotOpener:
        "Network redesign — to scope this I need to understand your topology today: how many VPCs, how many regions, and what hybrid connectivity is in place?",
    },
  },
  {
    slug: "managed-services",
    title: "Managed services for an existing GCP estate",
    tagline: "Day-2 ops, FinOps, security and on-call for an existing GCP environment.",
    icon: "lock",
    rank: 120,
    body: {
      title: "Managed services for existing GCP estate",
      executiveSummary:
        "We have an existing GCP estate and want a managed-service partner for day-2 ops, FinOps, security posture, and incident response.",
      scopeRequirements:
        "Assessment, runbook library, monitoring & alerting, FinOps cadence, security patch SLA, incident response.",
      successCriteria:
        "Defined SLAs and SLOs, ≥ 99.9% production availability, FinOps cadence operating monthly, IR drills passing.",
      copilotOpener:
        "Managed services — let's start with the scope: which workloads should be in-scope and what does your current ops topology look like?",
    },
  },
];

/**
 * Apply a template to an empty `ProjectBrief`. Idempotent: only fills
 * fields that are currently null/empty so we never overwrite the
 * customer's edits.
 */
export function projectBriefPatchFromTemplate(
  template: BriefTemplateCatalogueEntry,
): Record<string, string> {
  const patch: Record<string, string> = {};
  const b = template.body;
  if (b.title) patch.title = b.title;
  if (b.executiveSummary) patch.executiveSummary = b.executiveSummary;
  if (b.scopeRequirements) patch.scopeRequirements = b.scopeRequirements;
  if (b.integrationPoints) patch.integrationPoints = b.integrationPoints;
  if (b.dataSources) patch.dataSources = b.dataSources;
  if (b.successCriteria) patch.successCriteria = b.successCriteria;
  if (b.targetGoLive) patch.targetGoLive = b.targetGoLive;
  if (b.budgetRange) patch.budgetRange = b.budgetRange;
  if (b.preferredLocation) patch.preferredLocation = b.preferredLocation;
  if (b.requiredCertifications)
    patch.requiredCertifications = b.requiredCertifications;
  return patch;
}

/** Idempotent seed — safe to run on every deploy. */
export async function seedBriefTemplates(): Promise<void> {
  await Promise.all(
    BRIEF_TEMPLATES.map((t) =>
      insertRow(
        "BriefTemplate",
        {
          slug: t.slug,
          title: t.title,
          tagline: t.tagline,
          industry: t.industry ?? null,
          icon: t.icon,
          rank: t.rank,
          body: JSON.stringify(t.body),
        },
        {
          onConflict: `("slug") DO UPDATE SET
            "title" = EXCLUDED."title",
            "tagline" = EXCLUDED."tagline",
            "industry" = EXCLUDED."industry",
            "icon" = EXCLUDED."icon",
            "rank" = EXCLUDED."rank",
            "body" = EXCLUDED."body",
            "updatedAt" = EXCLUDED."updatedAt"`,
        },
      ),
    ),
  );
}

export function getBriefTemplateBySlug(
  slug: string,
): BriefTemplateCatalogueEntry | undefined {
  return BRIEF_TEMPLATES.find((t) => t.slug === slug);
}
