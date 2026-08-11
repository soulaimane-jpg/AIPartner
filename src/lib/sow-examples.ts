/**
 * Three curated SoW examples shown to customers as reference material.
 * Each example is rendered as a "tier" — Starter, Solid, Exemplar — along
 * with an annotation explaining what makes the stronger ones stronger.
 */

export type SowExampleTier = "starter" | "solid" | "exemplar";

export type SowExample = {
  id: string;
  tier: SowExampleTier;
  tierLabel: string;
  tierScore: number;
  title: string;
  oneLiner: string;
  industry: string;
  whyThisTier: string[];
  brief: {
    executiveSummary: string;
    scopeRequirements: { title: string; detail: string }[];
    successCriteria: { metric: string; target: string }[];
    dataSources: { name: string; detail: string }[];
    integrationPoints: { title: string; detail: string }[];
    customerRoles: string[];
    milestones: { title: string; date: string }[];
    targetGoLive: string;
    budgetRange: string;
    preferredLocation: string;
    requiredCertifications: string[];
    industryExperience: string[];
    procurementType: string;
    decisionMakers: string[];
    selectionCriteria: string[];
    services: string[];
  };
};

export const SOW_EXAMPLES: SowExample[] = [
  {
    id: "starter-retail-dwh",
    tier: "starter",
    tierLabel: "Starter",
    tierScore: 45,
    title: "Retailer wants a better data warehouse",
    oneLiner:
      "Vague scope, no metrics or timing — typical of a first conversation.",
    industry: "Retail",
    whyThisTier: [
      "No quantified success criteria",
      "Budget and go-live date missing",
      "No decision makers or selection criteria",
      "Scope items are described in one-liners without detail",
    ],
    brief: {
      executiveSummary:
        "We want to modernize our reporting stack. Current tools are slow and don't scale. Looking at BigQuery maybe.",
      scopeRequirements: [
        { title: "Move reports to BigQuery", detail: "" },
        { title: "Retire legacy warehouse", detail: "" },
      ],
      successCriteria: [],
      dataSources: [{ name: "Legacy DB", detail: "" }],
      integrationPoints: [],
      customerRoles: [],
      milestones: [],
      targetGoLive: "",
      budgetRange: "",
      preferredLocation: "",
      requiredCertifications: [],
      industryExperience: ["Retail"],
      procurementType: "",
      decisionMakers: [],
      selectionCriteria: [],
      services: ["Data Analytics"],
    },
  },

  {
    id: "solid-fsi-migration",
    tier: "solid",
    tierLabel: "Solid",
    tierScore: 78,
    title: "Mid-market FSI migration to Google Cloud",
    oneLiner:
      "A competent brief — enough for partner matching, still has minor gaps.",
    industry: "Financial Services",
    whyThisTier: [
      "Business context quantified (~800k monthly users)",
      "Success KPIs present but partial",
      "Budget range defined, procurement path captured",
      "Light on milestones and decision makers",
    ],
    brief: {
      executiveSummary:
        "Our core banking analytics run on an on-prem Oracle estate that is out of support in 18 months. We serve ~800k monthly active retail customers and need to migrate reporting and regulatory analytics to Google Cloud while staying within EU data residency.",
      scopeRequirements: [
        {
          title: "Migrate analytics workloads",
          detail:
            "Lift ~60 scheduled SQL workloads from Oracle Analytics to BigQuery; re-point Looker dashboards.",
        },
        {
          title: "Build golden customer view",
          detail:
            "Consolidate CRM, transactions, and support contacts into a single denormalized BigQuery table refreshed hourly.",
        },
        {
          title: "Regulatory reporting pipeline",
          detail:
            "Recreate our month-end Basel III reports in Dataflow + BigQuery with evidence trail.",
        },
      ],
      successCriteria: [
        { metric: "Report latency", target: "p95 < 8s (currently 45s)" },
        { metric: "Month-end close", target: "Complete in < 3 business days" },
      ],
      dataSources: [
        {
          name: "Oracle Analytics DW",
          detail: "12 TB, 200 tables, daily refresh",
        },
        { name: "Salesforce Financial Services Cloud", detail: "Customer CRM" },
        { name: "Kafka transactions stream", detail: "~4k TPS" },
      ],
      integrationPoints: [
        { title: "Looker", detail: "Existing dashboards need re-pointing" },
        {
          title: "SAP S/4HANA",
          detail: "Nightly finance extract, keep as source of truth",
        },
      ],
      customerRoles: ["Finance analysts", "Risk officers", "BI engineers"],
      milestones: [
        { title: "Architecture sign-off", date: "Aug 2026" },
        { title: "First workload live", date: "Oct 2026" },
      ],
      targetGoLive: "Q2 2027",
      budgetRange: "$700k–$900k USD",
      preferredLocation: "EMEA, data must remain in Netherlands or Germany",
      requiredCertifications: ["ISO 27001", "SOC 2 Type II"],
      industryExperience: ["Financial Services", "Banking"],
      procurementType: "VIA_RESELLER",
      decisionMakers: ["VP Data Platform", "Head of Risk"],
      selectionCriteria: [
        "GCP Data Analytics specialization",
        "Prior EU banking delivery",
      ],
      services: ["Data Analytics", "Cloud Migration"],
    },
  },

  {
    id: "exemplar-healthcare-ml",
    tier: "exemplar",
    tierLabel: "Exemplar",
    tierScore: 100,
    title: "Healthcare claims AI — 100% ready",
    oneLiner:
      "The gold standard. Every section rich, specific, and quantified.",
    industry: "Healthcare",
    whyThisTier: [
      "Quantified business context AND success criteria",
      "Concrete scope with technical depth",
      "Named systems for every integration",
      "Budget, timing, compliance, and stakeholders all present",
      "Explicit partner selection criteria",
    ],
    brief: {
      executiveSummary:
        "We process 2.4M claims/year across 8 regional payer entities. Current manual adjudication takes 6.8 days on average and costs $38/claim. We want to deploy a machine-learning-assisted adjudication pipeline on Vertex AI that auto-approves low-risk claims, flags suspected fraud, and routes the rest to our adjusters — targeting a 55% reduction in manual-touch claims within 12 months while retaining full HIPAA compliance and audit trail.",
      scopeRequirements: [
        {
          title: "Claims risk model",
          detail:
            "Train a gradient-boosted model on 3 years of historical claims + adjudicator decisions. Serve via Vertex AI Endpoint with < 300ms p95.",
        },
        {
          title: "Fraud detection layer",
          detail:
            "Graph-based anomaly detection over provider-patient relationships using BigQuery ML and Neo4j reference for explainability.",
        },
        {
          title: "Adjudicator review UI",
          detail:
            "Internal web app on Cloud Run with explanations per flagged claim, human override, and audit logging to Cloud Logging + BigQuery.",
        },
        {
          title: "HIPAA-compliant data pipeline",
          detail:
            "Ingest EDI 837/835 from partners through Pub/Sub → Dataflow → BigQuery with tokenization of PHI fields using Cloud DLP templates.",
        },
      ],
      successCriteria: [
        {
          metric: "Manual-touch claims",
          target: "Reduce from 72% to ≤ 32% within 12 months",
        },
        {
          metric: "Claim adjudication latency (p50)",
          target: "< 4 hours (currently 6.8 days)",
        },
        {
          metric: "Fraud recovery",
          target: "$4.2M recovered in year 1 (baseline $600k)",
        },
        {
          metric: "Model auditability",
          target: "100% decisions explainable via SHAP report",
        },
      ],
      dataSources: [
        {
          name: "Claims DB (Postgres)",
          detail: "~40 TB, partitioned by year, 2.4M/yr new claims",
        },
        {
          name: "Provider registry",
          detail: "NPI-keyed CSV feed refreshed weekly from CMS",
        },
        {
          name: "Historical adjudications",
          detail: "12 years, 28M decisions, labeled with outcome codes",
        },
      ],
      integrationPoints: [
        {
          title: "Epic EHR",
          detail: "HL7 FHIR R4 push of approved claim status",
        },
        {
          title: "Zendesk",
          detail: "Auto-ticket creation for suspected-fraud cases",
        },
        {
          title: "SFTP partner feeds",
          detail: "7 payer partners — 837/835 EDI files, hourly",
        },
      ],
      customerRoles: [
        "Claims adjusters",
        "Fraud investigators",
        "Actuaries",
        "Compliance officers",
      ],
      milestones: [
        { title: "Architecture + security review", date: "Mar 2026" },
        { title: "Pilot (1 region, 50k claims)", date: "Jun 2026" },
        { title: "Production rollout", date: "Nov 2026" },
        { title: "Full 8-region cutover", date: "Apr 2027" },
      ],
      targetGoLive: "Q2 2027",
      budgetRange: "$1.8M–$2.4M USD (implementation + 1yr support)",
      preferredLocation: "US, data residency in us-central1 and us-east4",
      requiredCertifications: [
        "HIPAA",
        "HITRUST CSF",
        "SOC 2 Type II",
        "ISO 27001",
      ],
      industryExperience: ["Healthcare", "Health Insurance"],
      procurementType: "DIRECT_GOOGLE",
      decisionMakers: [
        "CTO",
        "Chief Medical Officer",
        "Chief Compliance Officer",
        "VP Claims Operations",
      ],
      selectionCriteria: [
        "GCP ML Specialization",
        "Prior HIPAA-compliant production ML delivery",
        "US-based delivery team with 24/5 support",
        "Experience with EDI / X12 transactions",
        "Fixed-price milestone billing preferred",
      ],
      services: ["Machine Learning", "Data Analytics", "Security"],
    },
  },
];

export function getExample(id: string): SowExample | undefined {
  return SOW_EXAMPLES.find((e) => e.id === id);
}
