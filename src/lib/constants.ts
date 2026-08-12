import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Wrench,
  Users,
  Headphones,
  GraduationCap,
  FileText,
  Search,
  ClipboardCheck,
  FileSignature,
  UserCheck,
  Handshake,
} from "lucide-react";

export const BRAND = {
  name: "AI Partner",
  tagline: "Next-Gen Cloud Architecture",
  copyright: `© ${new Date().getFullYear()} AI Partner. All rights reserved.`,
};

export const PARTNER_SERVICES: {
  key: "RESELLING" | "CONSULTING" | "MANAGED" | "SUPPORT" | "TRAINING";
  title: string;
  persona: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    key: "RESELLING",
    title: "Financial Protocol",
    persona: "Billing Logic",
    icon: CreditCard,
    description:
      "Optimization of GCP spend, invoice aggregation, and strategic credit allocation.",
  },
  {
    key: "CONSULTING",
    title: "Architecture Design",
    persona: "Build Engine",
    icon: Wrench,
    description:
      "Core infrastructure deployment, application modernization, and large-scale data migrations.",
  },
  {
    key: "MANAGED",
    title: "Operational Relay",
    persona: "Stability Node",
    icon: Users,
    description:
      "Continuous 24/7 observability, incident response protocols, and security posture management.",
  },
  {
    key: "SUPPORT",
    title: "Technical Support",
    persona: "Resolution Node",
    icon: Headphones,
    description:
      "Direct L3 engineering access for rapid resolution of high-priority system failures.",
  },
  {
    key: "TRAINING",
    title: "Knowledge Transfer",
    persona: "Intelligence Scaling",
    icon: GraduationCap,
    description:
      "High-bandwidth internal team upskilling and GCP certification bootcamps.",
  },
];

export const PIPELINE_STEPS: {
  label: string;
  actor: "Client" | "AI Partner" | "Partners";
  description: string;
  icon: LucideIcon;
  stage: "INTAKE" | "SOURCING" | "REVIEW" | "PROPOSALS" | "SELECTION" | "INTRODUCTION";
}[] = [
  {
    label: "Scope",
    actor: "Client",
    description: "Build your Statement of Work with the AI assistant.",
    icon: FileText,
    stage: "INTAKE",
  },
  {
    label: "Sourcing",
    actor: "AI Partner",
    description: "Our team identifies the best-fit GCP partners for your brief.",
    icon: Search,
    stage: "SOURCING",
  },
  {
    label: "Review",
    actor: "Client",
    description: "Review proposed partners and approve who sees your SoW.",
    icon: ClipboardCheck,
    stage: "REVIEW",
  },
  {
    label: "Proposals",
    actor: "Partners",
    description: "Approved partners draft and submit their proposals.",
    icon: FileSignature,
    stage: "PROPOSALS",
  },
  {
    label: "Selection",
    actor: "Client",
    description: "Compare proposals and pick your partner.",
    icon: UserCheck,
    stage: "SELECTION",
  },
  {
    label: "Kickoff",
    actor: "AI Partner",
    description: "Warm introduction and engagement kickoff.",
    icon: Handshake,
    stage: "INTRODUCTION",
  },
];

/**
 * Google Cloud's **actual** partner specializations.
 *
 * This list previously held invented names ("Generative AI Nodes",
 * "Zero-Trust Security", "Advanced ML") that appear in no Google taxonomy. The
 * directory importer extracts the real names, failed to match them here, and
 * silently dumped them into `expertiseAreas` — which is why imported profiles
 * ended up with verticals and specializations filed as "products", and why
 * specialization-based matching almost never hit.
 *
 * The canonical vocabulary now lives in the tag library
 * (`src/lib/tag-seed.ts`, facet `specialization`). This constant remains only
 * for the legacy profile form and must stay in sync with those slugs.
 */
export const GCP_SPECIALIZATIONS = [
  "Data Analytics",
  "Machine Learning",
  "Cloud Migration",
  "Application Development",
  "Infrastructure",
  "Security",
  "Work Transformation – Enterprise",
  "SAP on Google Cloud",
  "Marketing Analytics",
  "Education",
  "Training Services",
  "Data Warehouse Modernization",
];

export const PARTNER_TIERS = [
  { key: "MEMBER", label: "Member" },
  { key: "PARTNER", label: "Partner" },
  { key: "PREMIER", label: "Premier Partner" },
] as const;

export const STAGE_LABELS: Record<string, string> = {
  INTAKE: "Scope",
  SOURCING: "Sourcing",
  REVIEW: "Review",
  PROPOSALS: "Proposals",
  SELECTION: "Selection",
  INTRODUCTION: "Kickoff",
  CLOSED: "Closed",
};

/**
 * Human labels for the canonical `leadState` pipeline. `STAGE_LABELS`
 * above describes the derived legacy `stage` column; prefer these
 * wherever the precise pipeline position matters.
 */
export const LEAD_STATE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_TRIAGE: "In triage",
  CLARIFICATION_NEEDED: "Clarification needed",
  LEAD_APPROVED: "Approved",
  PARTNERS_SELECTED: "Partners selected",
  SENT_TO_PARTNERS: "Sent to partners",
  PROPOSALS_IN_REVIEW: "Proposals in review",
  COMPARISON_RELEASED: "Comparison released",
  COMPANY_SELECTED: "Partner selected",
  REVEAL_APPROVED: "Identities revealed",
  MEETINGS_SCHEDULED: "Meetings scheduled",
  COMPLETED: "Completed",
  DROPPED_OFF: "Dropped off",
  CANCELLED: "Cancelled",
  STALLED: "Stalled",
};

export const STAGE_ORDER = [
  "INTAKE",
  "SOURCING",
  "REVIEW",
  "PROPOSALS",
  "SELECTION",
  "INTRODUCTION",
] as const;

export const SERVICE_CATEGORIES_LABEL: Record<string, string> = {
  RESELLING: "Financial Layer",
  CONSULTING: "Engineering Layer",
  MANAGED: "Operations Layer",
  SUPPORT: "Support Layer",
  TRAINING: "Education Layer",
};
