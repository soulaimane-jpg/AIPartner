export const CHALLENGE_AREAS = [
  {
    key: "reselling",
    title: "Reselling & Commercial Optimization",
    description: "Optimize your GCP billing, unlock volume credits, and structure better commercial discounts.",
    tags: ["Volume Credits", "Better Discounts", "Invoicing"],
    service: "RESELLING",
  },
  {
    key: "consulting",
    title: "Consulting & Project Delivery",
    description: "Get hands-on engineering for migrations, architecture design, or data and AI implementations.",
    tags: ["Migrations", "AI / Data Platforms", "Architecture"],
    service: "CONSULTING",
  },
  {
    key: "managed_services",
    title: "Managed Services (Ongoing Ops)",
    description: "Secure 24/7 day-to-day cloud operations, proactive monitoring, patching, and SLA-backed support.",
    tags: ["24/7 Operations", "Monitoring", "SLA Guarantees"],
    service: "MANAGED",
  },
  {
    key: "reactive_support",
    title: "Reactive Support",
    description: "Access fast, ticket-based break-fix technical help and escalation only when things go wrong.",
    tags: ["On-Demand Help", "Break-Fix Tickets", "L1–L4 Escalation"],
    service: "SUPPORT",
  },
  {
    key: "training",
    title: "Training & Enablement",
    description: "Upskill your internal engineering teams through hands-on labs and GCP certification prep.",
    tags: ["Hands-on Labs", "Certification Prep"],
    service: "TRAINING",
  },
] as const;

export type ChallengeArea = (typeof CHALLENGE_AREAS)[number]["key"];
export const CHALLENGE_AREA_KEYS = CHALLENGE_AREAS.map((area) => area.key) as [ChallengeArea, ...ChallengeArea[]];
