/**
 * Static reference content for the /templates page.
 *
 * One entry per service-category. Each entry describes:
 *   • proposalFormat — what shape the partner's proposal will take
 *   • inputs         — fields you'll be asked to provide, with an
 *                      example "good" answer and the rationale for why
 *                      partners need it.
 */

import type { ServiceCategory } from "@/lib/enums";
import { SERVICE_CATEGORIES_LABEL } from "@/lib/constants";

export type TemplateInput = {
  label: string;
  example: string;
  rationale: string;
};

export type Template = {
  key: ServiceCategory;
  category: string;
  title: string;
  description: string;
  proposalFormat: string[];
  inputs: TemplateInput[];
};

export const TEMPLATES: Template[] = [
  {
    key: "RESELLING",
    category: SERVICE_CATEGORIES_LABEL.RESELLING,
    title: "Reselling — billing & commercial",
    description:
      "A partner takes over the commercial relationship with Google Cloud: invoicing, volume credits, account management. Proposals are mostly commercial, not technical.",
    proposalFormat: [
      "Pricing model — list-minus discount or flat margin, in writing.",
      "Billing terms — invoice cadence, currency, payment terms (e.g. NET-30).",
      "Account team — named TAM / customer success contact + escalation path.",
      "Value-add services included — cost reviews, optimisation, BAA / DPA.",
      "Commitment — month-to-month vs. annual, exit clause, transfer process.",
    ],
    inputs: [
      {
        label: "Annual cloud spend",
        example: "~€420k / year on GCP today, growing 20% YoY.",
        rationale:
          "Partners price discounts off your committed annual spend. A range or rough number is enough — they'll align on exact figures during sourcing.",
      },
      {
        label: "Current procurement",
        example: "Direct with Google on monthly invoice, no commit.",
        rationale:
          "Tells partners whether they're inheriting an existing contract, switching from direct, or starting fresh — affects the transfer plan.",
      },
      {
        label: "Services in scope",
        example:
          "BigQuery, GKE, Cloud SQL, Vertex AI. Workspace handled separately.",
        rationale:
          "Some partners specialise in core IaaS, others in Workspace, Maps or Marketplace. Lets them confirm full coverage upfront.",
      },
      {
        label: "Required value-adds",
        example:
          "Quarterly cost-optimisation review, dedicated TAM, EU billing entity.",
        rationale:
          "Partners differentiate on services bundled around the discount. Be explicit so you can compare apples to apples.",
      },
      {
        label: "Decision timeline",
        example: "Need to sign by 30 June; current MSA expires 31 July.",
        rationale:
          "Drives partner urgency and lets them flag if onboarding fits your window (transfers usually take 2–4 weeks).",
      },
    ],
  },
  {
    key: "CONSULTING",
    category: SERVICE_CATEGORIES_LABEL.CONSULTING,
    title: "Consulting — project delivery",
    description:
      "Hands-on delivery: solution architecture, building or migrating workloads, data / AI platforms, security implementation. Proposals are scoped projects with deliverables and a fixed or T&M price.",
    proposalFormat: [
      "Statement of Work — phased delivery plan with milestones and deliverables.",
      "Team composition — named roles (architect, eng, PM), seniority, day rate.",
      "Pricing — fixed price per phase, T&M with cap, or time-boxed sprint.",
      "Risk register — top 3–5 risks with mitigations.",
      "Acceptance criteria — what 'done' looks like for each milestone.",
      "Handover plan — documentation, runbooks, knowledge transfer.",
    ],
    inputs: [
      {
        label: "Business outcome",
        example:
          'Reduce data-platform ops cost by 35% in 9 months while keeping ISO 27001.',
        rationale:
          "Outcomes (not features) drive partner solution design. Quantify what 'success' means and tie it to a date.",
      },
      {
        label: "Current state",
        example:
          "On-prem Vertica + Airflow on VMs, 200 users, ~80 dashboards in Tableau.",
        rationale:
          "Partners need the starting point to estimate migration effort and surface compatibility risks early.",
      },
      {
        label: "Target architecture",
        example:
          "BigQuery + Looker + Cloud Composer; Cloud DLP for masking; data residency in europe-west.",
        rationale:
          "Even a rough sketch saves a discovery week. If you don't know, say so — partners will propose options.",
      },
      {
        label: "Constraints",
        example:
          "Must keep HIPAA-equivalent controls. Cannot move PII outside EU. No downtime > 4h.",
        rationale:
          "Constraints often dwarf the happy-path scope. Surface them upfront so proposals don't pretend they don't exist.",
      },
      {
        label: "Budget envelope",
        example: "€280–360k over 6 months, capex preferred.",
        rationale:
          "Range, not a single number. Lets partners scope Tier-A vs Tier-B options instead of guessing.",
      },
      {
        label: "Go-live date",
        example: "31 March 2026 — drop-dead, tied to data-warehouse retirement.",
        rationale:
          "Partners staff differently for hard vs. soft deadlines. Be explicit about which dates are immovable.",
      },
    ],
  },
  {
    key: "MANAGED",
    category: SERVICE_CATEGORIES_LABEL.MANAGED,
    title: "Managed services — ongoing operations",
    description:
      "Continuous run of your cloud day-to-day after launch: monitoring, patching, incident response, with an SLA. Proposals look like service contracts, not project plans.",
    proposalFormat: [
      "Service catalogue — covered platforms, what's in vs out of scope.",
      "SLA — response / restore times by severity, uptime target, credit table.",
      "Operating model — 24/7 vs business hours, follow-the-sun, on-call rota.",
      "Reporting — monthly ops review, incident reports, change management.",
      "Pricing — flat per-month, per-resource, or T-shirt tiers.",
      "Off-boarding — exit assistance, runbook handover.",
    ],
    inputs: [
      {
        label: "Estate to manage",
        example:
          "3 GCP projects, 12 GKE clusters, 80 services, ~40 BigQuery jobs/day.",
        rationale:
          "Partners price by complexity (resource count + criticality). A clear inventory keeps quotes comparable.",
      },
      {
        label: "Hours of coverage",
        example: "24/7 for prod, business hours (CET) for staging.",
        rationale:
          "Drives staffing and follow-the-sun cost — the single biggest line item in managed pricing.",
      },
      {
        label: "Severity definitions",
        example: "P1 = customer-impacting outage, response < 15 min, restore < 2h.",
        rationale:
          "Without sev definitions, SLAs are meaningless. If you don't have your own, partners will propose theirs.",
      },
      {
        label: "Tooling expectations",
        example:
          "Use our existing PagerDuty + Datadog. No proprietary partner tooling.",
        rationale:
          "Decides whether you inherit lock-in. Partners with their own tooling can be cheaper but harder to off-board.",
      },
      {
        label: "Incident reporting",
        example:
          "Postmortem within 5 business days for P1/P2; monthly ops review on-site.",
        rationale:
          "Sets the cadence and depth of communication you should expect — and budget for.",
      },
    ],
  },
  {
    key: "SUPPORT",
    category: SERVICE_CATEGORIES_LABEL.SUPPORT,
    title: "Support — reactive help",
    description:
      "Ticket-based assistance, L1–L3 escalation, break-fix coverage. Lighter than managed services: no proactive ops, just answers when something breaks.",
    proposalFormat: [
      "Tier definitions — L1 / L2 / L3 scope and example issues.",
      "Channels — portal, email, phone, chat. Hours per channel.",
      "Response SLA per severity — response only, not restore.",
      "Ticket bundle — included tickets per month + overage rate.",
      "Pricing — flat retainer or per-ticket bucket.",
    ],
    inputs: [
      {
        label: "Workloads in scope",
        example:
          "All GCP projects under our 'prod-*' folder; Cloud SQL and BigQuery only.",
        rationale:
          "Tighter scope = lower price. Be explicit about what's covered so users don't open out-of-scope tickets.",
      },
      {
        label: "Expected ticket volume",
        example: "~25 tickets / month, 2–3 P1 per quarter.",
        rationale:
          "Lets partners size the bundle. If you don't know, ask for a 3-month pilot with truing-up afterwards.",
      },
      {
        label: "Authorised contacts",
        example: "5 named engineers may open tickets; 2 may escalate to P1.",
        rationale:
          "Partners cap who can open tickets to control noise. Surface the names upfront so onboarding doesn't stall.",
      },
      {
        label: "Languages",
        example: "English, French (CET business hours).",
        rationale:
          "Affects pool size and price. Multi-language coverage usually requires a follow-the-sun team.",
      },
    ],
  },
  {
    key: "TRAINING",
    category: SERVICE_CATEGORIES_LABEL.TRAINING,
    title: "Training & enablement",
    description:
      "Workshops, hands-on labs, certification prep. Proposals look like a course catalogue with delivery format and pricing per cohort.",
    proposalFormat: [
      "Course list — titles, duration, prerequisites, outcomes.",
      "Delivery format — in-person, virtual, self-paced, blended.",
      "Cohort size — minimum / maximum learners per session.",
      "Pricing — per cohort, per learner, or annual subscription.",
      "Completion artefacts — certificates, lab access, recordings.",
      "Trainer credentials — Google Cloud certifications + years of experience.",
    ],
    inputs: [
      {
        label: "Audience",
        example:
          "20 backend engineers, mid-level, new to GCP. Ramp-up over 6 weeks.",
        rationale:
          "Audience seniority drives content depth — a 101 for new joiners is half the price of an architect bootcamp.",
      },
      {
        label: "Outcome / certification",
        example:
          "PCA exam pass-rate ≥ 80% within 3 months of training completion.",
        rationale:
          "Some partners guarantee outcomes (with a re-training clause). Others just deliver content. Be explicit about what you want.",
      },
      {
        label: "Format preference",
        example:
          "Virtual instructor-led (CET), hands-on labs, max 12 / cohort.",
        rationale:
          "In-person is 2–3× the cost of virtual. Lab access (e.g. Qwiklabs) is usually charged per learner per month.",
      },
      {
        label: "Existing materials",
        example:
          "We already use Coursera Plus. Want partner-led labs to complement it.",
        rationale:
          "Partners can plug into your existing LMS or replace it. Tell them what you keep so they don't quote a duplicate.",
      },
      {
        label: "Timeline",
        example:
          "Kick-off Sep, certification window Oct–Nov, before annual planning in Dec.",
        rationale:
          "Most partners run cohorts on a calendar; surface your dates so they propose realistic delivery slots.",
      },
    ],
  },
];
