/**
 * Canonical seed catalogue for the tag library.
 *
 * This is the "Scrape & Seed" step of the tag pipeline, captured as data.
 * `scripts/seed-tag-library.cjs` writes it to the `Tag` table; nothing reads
 * it at runtime, because the DB is the source of truth once seeded.
 *
 * Two things to be careful with:
 *
 *  1. **`slug` is the identity.** Changing one orphans every partner using
 *     it. To rename, change `label` and leave `slug` alone.
 *  2. **`synonyms` are why the library stays clean.** Every alternate
 *     spelling you list here is an entry that will never fork into a
 *     duplicate tag. Be generous.
 *
 * The specialization list below is Google's real taxonomy. The old
 * `GCP_SPECIALIZATIONS` constant contained invented names ("Generative AI
 * Nodes", "Zero-Trust Security") that no partner directory would ever
 * return, which is why directory imports never matched them.
 */

import type { PillarKey, TagFacet } from "@/lib/partner-pillars";

export interface SeedTag {
  slug: string;
  label: string;
  facet: TagFacet;
  pillar: PillarKey;
  synonyms?: string[];
}

// ─── Pillar 1: platforms ──────────────────────────────────────

const PLATFORMS: SeedTag[] = [
  {
    slug: "google-cloud-platform",
    label: "Google Cloud Platform (GCP)",
    facet: "platform",
    pillar: "positioning",
    synonyms: ["gcp", "google-cloud", "google", "gcloud"],
  },
  {
    slug: "aws",
    label: "Amazon Web Services (AWS)",
    facet: "platform",
    pillar: "positioning",
    synonyms: ["amazon-web-services", "amazon"],
  },
  {
    slug: "azure",
    label: "Microsoft Azure",
    facet: "platform",
    pillar: "positioning",
    synonyms: ["microsoft-azure", "ms-azure"],
  },
  {
    slug: "multi-cloud",
    label: "Multi-Cloud",
    facet: "platform",
    pillar: "positioning",
    synonyms: ["hybrid-cloud", "multicloud"],
  },
];

// ─── Pillar 1: Google Cloud specializations ───────────────────
//
// Source: the official partner-directory taxonomy. These are the strings
// the directory importer actually returns, so imports now match cleanly.

const SPECIALIZATIONS: SeedTag[] = [
  {
    slug: "data-analytics",
    label: "Data Analytics",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["big-data-analytics", "analytics"],
  },
  {
    slug: "machine-learning",
    label: "Machine Learning",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["advanced-ml", "ml", "ai-ml"],
  },
  {
    slug: "cloud-migration",
    label: "Cloud Migration",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["enterprise-migration", "migration"],
  },
  {
    slug: "application-development",
    label: "Application Development",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["app-development", "app-dev"],
  },
  {
    slug: "infrastructure",
    label: "Infrastructure",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["cloud-native-infra", "infra"],
  },
  {
    slug: "security",
    label: "Security",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["zero-trust-security", "cloud-security"],
  },
  {
    slug: "work-transformation-enterprise",
    label: "Work Transformation – Enterprise",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["work-transformation", "workspace"],
  },
  {
    slug: "sap-on-google-cloud",
    label: "SAP on Google Cloud",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["sap-architecture", "sap"],
  },
  {
    slug: "marketing-analytics",
    label: "Marketing Analytics",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["marketing-intelligence"],
  },
  {
    slug: "education",
    label: "Education",
    facet: "specialization",
    pillar: "positioning",
  },
  {
    slug: "training-services",
    label: "Training Services",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["training"],
  },
  {
    slug: "data-warehouse-modernization",
    label: "Data Warehouse Modernization",
    facet: "specialization",
    pillar: "positioning",
    synonyms: ["data-lake-management", "dwh-modernization"],
  },
];

// ─── Pillar 1: workloads ──────────────────────────────────────

const WORKLOADS: SeedTag[] = [
  {
    slug: "application-modernization",
    label: "Application Modernization",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["app-modernization", "refactoring"],
  },
  {
    slug: "data-warehousing-analytics",
    label: "Data Warehousing & Analytics",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["data-warehousing", "bi"],
  },
  {
    slug: "cloud-migration-infrastructure",
    label: "Cloud Migration / Infrastructure",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["lift-and-shift", "datacenter-exit"],
  },
  {
    slug: "generative-ai-mlops",
    label: "Generative AI / MLOps",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["genai", "generative-ai", "mlops", "llm"],
  },
  {
    slug: "security-compliance",
    label: "Security & Compliance",
    facet: "workload",
    pillar: "positioning",
  },
  {
    slug: "finops-cost-optimization",
    label: "FinOps & Cost Optimization",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["finops", "cost-optimization", "cloud-economics"],
  },
  {
    slug: "mainframe-modernization",
    label: "Mainframe Modernization",
    facet: "workload",
    pillar: "positioning",
  },
  {
    slug: "sap-migration",
    label: "SAP Migration",
    facet: "workload",
    pillar: "positioning",
  },
  {
    slug: "data-platform-engineering",
    label: "Data Platform Engineering",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["data-engineering", "data-pipelines"],
  },
  {
    slug: "devops-platform-engineering",
    label: "DevOps & Platform Engineering",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["devops-lifecycle", "devops", "sre"],
  },
  {
    slug: "networking",
    label: "Networking",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["core-networking"],
  },
  {
    slug: "disaster-recovery",
    label: "Disaster Recovery & Resilience",
    facet: "workload",
    pillar: "positioning",
    synonyms: ["dr", "business-continuity"],
  },
];

// ─── Pillar 1: verticals ──────────────────────────────────────

const VERTICALS: SeedTag[] = [
  { slug: "financial-services", label: "Financial Services", facet: "vertical", pillar: "positioning", synonyms: ["fsi", "banking", "finance"] },
  { slug: "healthcare-life-sciences", label: "Healthcare & Life Sciences", facet: "vertical", pillar: "positioning", synonyms: ["healthcare", "life-sciences", "pharma"] },
  { slug: "retail-ecommerce", label: "Retail & E-Commerce", facet: "vertical", pillar: "positioning", synonyms: ["retail", "ecommerce"] },
  { slug: "manufacturing-iot", label: "Manufacturing & IoT", facet: "vertical", pillar: "positioning", synonyms: ["manufacturing", "industrial", "iot"] },
  { slug: "saas-isv", label: "SaaS / ISV", facet: "vertical", pillar: "positioning", synonyms: ["saas", "isv", "software"] },
  { slug: "public-sector", label: "Public Sector & Government", facet: "vertical", pillar: "positioning", synonyms: ["government", "gov", "public-services"] },
  { slug: "media-entertainment", label: "Media & Entertainment", facet: "vertical", pillar: "positioning", synonyms: ["media", "entertainment"] },
  { slug: "telecommunications", label: "Telecommunications", facet: "vertical", pillar: "positioning", synonyms: ["telco", "telecom"] },
  { slug: "energy-utilities", label: "Energy & Utilities", facet: "vertical", pillar: "positioning", synonyms: ["energy", "utilities", "oil-and-gas"] },
  { slug: "education-vertical", label: "Education", facet: "vertical", pillar: "positioning", synonyms: ["edu", "higher-education"] },
  { slug: "transport-logistics", label: "Transport & Logistics", facet: "vertical", pillar: "positioning", synonyms: ["logistics", "supply-chain"] },
  { slug: "gaming", label: "Gaming", facet: "vertical", pillar: "positioning", synonyms: ["games"] },
];

// ─── Pillar 1: compliance ─────────────────────────────────────

const COMPLIANCE: SeedTag[] = [
  { slug: "hipaa", label: "HIPAA", facet: "compliance", pillar: "positioning", synonyms: ["hipaa-hitech"] },
  { slug: "pci-dss", label: "PCI-DSS", facet: "compliance", pillar: "positioning", synonyms: ["pci"] },
  { slug: "fedramp", label: "FedRAMP", facet: "compliance", pillar: "positioning" },
  { slug: "gdpr", label: "GDPR", facet: "compliance", pillar: "positioning", synonyms: ["eu-data-protection"] },
  { slug: "soc-2", label: "SOC 2", facet: "compliance", pillar: "positioning", synonyms: ["soc2"] },
  { slug: "iso-27001", label: "ISO 27001", facet: "compliance", pillar: "positioning", synonyms: ["iso27001"] },
  { slug: "dora", label: "DORA", facet: "compliance", pillar: "positioning" },
  { slug: "nis2", label: "NIS2", facet: "compliance", pillar: "positioning" },
  { slug: "core-banking", label: "Core Banking Regulation", facet: "compliance", pillar: "positioning" },
  { slug: "hitrust", label: "HITRUST", facet: "compliance", pillar: "positioning" },
];

// ─── Pillar 1: products ───────────────────────────────────────

const PRODUCTS: SeedTag[] = [
  { slug: "bigquery", label: "BigQuery", facet: "product", pillar: "positioning", synonyms: ["big-query"] },
  { slug: "vertex-ai", label: "Vertex AI", facet: "product", pillar: "positioning", synonyms: ["vertexai"] },
  { slug: "gke", label: "Google Kubernetes Engine (GKE)", facet: "product", pillar: "positioning", synonyms: ["kubernetes-engine", "kubernetes"] },
  { slug: "cloud-run", label: "Cloud Run", facet: "product", pillar: "positioning" },
  { slug: "looker", label: "Looker", facet: "product", pillar: "positioning", synonyms: ["looker-studio"] },
  { slug: "dataflow", label: "Dataflow", facet: "product", pillar: "positioning" },
  { slug: "pubsub", label: "Pub/Sub", facet: "product", pillar: "positioning", synonyms: ["pub-sub", "cloud-pubsub"] },
  { slug: "apigee", label: "Apigee", facet: "product", pillar: "positioning" },
  { slug: "anthos", label: "Anthos", facet: "product", pillar: "positioning" },
  { slug: "spanner", label: "Cloud Spanner", facet: "product", pillar: "positioning", synonyms: ["cloud-spanner"] },
  { slug: "cloud-sql", label: "Cloud SQL", facet: "product", pillar: "positioning" },
  { slug: "firestore", label: "Firestore", facet: "product", pillar: "positioning" },
  { slug: "dataproc", label: "Dataproc", facet: "product", pillar: "positioning" },
  { slug: "composer", label: "Cloud Composer", facet: "product", pillar: "positioning", synonyms: ["airflow"] },
  { slug: "security-command-center", label: "Security Command Center", facet: "product", pillar: "positioning", synonyms: ["scc"] },
  { slug: "chronicle", label: "Google SecOps (Chronicle)", facet: "product", pillar: "positioning", synonyms: ["chronicle-siem"] },
  { slug: "terraform", label: "Terraform", facet: "product", pillar: "positioning", synonyms: ["hashicorp-terraform"] },
  { slug: "gemini", label: "Gemini", facet: "product", pillar: "positioning", synonyms: ["gemini-api"] },
  { slug: "bigtable", label: "Bigtable", facet: "product", pillar: "positioning" },
  { slug: "dialogflow", label: "Dialogflow", facet: "product", pillar: "positioning" },
];

// ─── Pillar 2: asset categories ───────────────────────────────

const ASSET_CATEGORIES: SeedTag[] = [
  { slug: "iac-terraform-libraries", label: "IaC / Terraform Libraries", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["terraform-modules", "iac"] },
  { slug: "landing-zones", label: "Pre-built Landing Zones", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["landing-zone"] },
  { slug: "finops-dashboards", label: "Proprietary FinOps Dashboards", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["cost-dashboards"] },
  { slug: "migration-automation", label: "Migration Scripts & Automation", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["migration-scripts"] },
  { slug: "data-pipeline-blueprints", label: "Data Pipeline Blueprints", facet: "asset_category", pillar: "ip_accelerators" },
  { slug: "security-guardrails", label: "Custom Security Guardrails", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["policy-as-code", "guardrails"] },
  { slug: "genai-accelerators", label: "GenAI Accelerators", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["llm-accelerators"] },
  { slug: "observability-stack", label: "Observability Stack", facet: "asset_category", pillar: "ip_accelerators", synonyms: ["monitoring-stack"] },
];

// ─── Pillar 5: metric types ───────────────────────────────────

const METRICS: SeedTag[] = [
  { slug: "cloud-cost-savings", label: "Cloud Cost Savings %", facet: "metric", pillar: "proof", synonyms: ["cost-savings"] },
  { slug: "deployment-speed", label: "Deployment Speed Improvement", facet: "metric", pillar: "proof", synonyms: ["time-to-deploy"] },
  { slug: "downtime-reduction", label: "Downtime Reduction", facet: "metric", pillar: "proof", synonyms: ["uptime-improvement"] },
  { slug: "latency-reduction", label: "Data Processing Latency Reduction", facet: "metric", pillar: "proof", synonyms: ["latency"] },
  { slug: "migration-volume", label: "Migration Volume Delivered", facet: "metric", pillar: "proof", synonyms: ["data-migrated"] },
  { slug: "revenue-impact", label: "Revenue / Conversion Impact", facet: "metric", pillar: "proof" },
  { slug: "compliance-attained", label: "Compliance Certification Attained", facet: "metric", pillar: "proof" },
];

export const SEED_TAGS: SeedTag[] = [
  ...PLATFORMS,
  ...SPECIALIZATIONS,
  ...WORKLOADS,
  ...VERTICALS,
  ...COMPLIANCE,
  ...PRODUCTS,
  ...ASSET_CATEGORIES,
  ...METRICS,
];
