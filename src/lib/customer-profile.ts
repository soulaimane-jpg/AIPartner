/**
 * Customer profile types + anonymization pipeline.
 *
 * The platform stores TWO views of the customer's profile:
 *
 *   1. rawProfile          — full extracted data (names, contacts). Only
 *                            the customer themselves can see this.
 *
 *   2. anonymizedProfile   — "shareable" form. Stripped of PII and specific
 *                            identifiers; retains industry, size, region,
 *                            seniority, and stated goals. Attached to SoWs
 *                            shared with admins / matched partners.
 */

export type CustomerRawProfile = {
  fullName: string;
  role: string;
  seniority: string; // "IC" | "Manager" | "Director" | "VP" | "C-Level"
  headline: string; // one-liner from LinkedIn "about"
  summary: string; // longer bio
  company: {
    name: string;
    industry: string;
    size: string; // "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+"
    website: string;
    hq: string;
    region: string; // "North America" | "EMEA" | "APAC" | "LATAM"
  };
  expertise: string[]; // technology / domain tags
  pastProjects: string[]; // short descriptions
  careerHighlights: string[];
  goals: string[]; // stated strategic goals / initiatives
  contactHints: {
    email?: string;
    phone?: string;
    linkedin?: string;
  };
};

/**
 * The anonymized view purposefully omits names, contact info, and specific
 * company identifiers. We keep only signals that help partners decide if
 * they're a good fit.
 */
export type CustomerAnonymizedProfile = {
  seniority: string; // e.g. "VP / Director"
  roleCategory: string; // e.g. "Engineering leadership"
  expertise: string[];
  industry: string;
  companySize: string;
  companyRegion: string;
  goals: string[];
  pastProjectCategories: string[];
  // Reason codes the AI thinks this customer is a good/bad match for certain partners
  maturitySignals: string[];
};

const SENIORITY_MAP: Record<string, string> = {
  "ic": "Individual contributor",
  "manager": "Manager",
  "director": "Director",
  "vp": "VP / Director",
  "c-level": "Executive (C-level)",
  "chief": "Executive (C-level)",
  "head": "Director",
  "lead": "Manager",
};

const ROLE_CATEGORY_MAP: Array<[RegExp, string]> = [
  [/cto|chief technology|vp engineering|engineering director/i, "Engineering leadership"],
  [/cio|chief information|it director/i, "IT leadership"],
  [/ciso|chief security|security director/i, "Security leadership"],
  [/cdo|chief data|data director|vp data/i, "Data leadership"],
  [/ceo|founder|cofounder/i, "Business executive"],
  [/coo|operations/i, "Operations leadership"],
  [/product manager|vp product|product director/i, "Product leadership"],
  [/architect/i, "Architecture"],
  [/devops|platform engineer/i, "Platform / DevOps"],
  [/data scientist|ml engineer|analytics/i, "Data / ML"],
  [/finance|cfo/i, "Finance leadership"],
  [/marketing|cmo/i, "Marketing leadership"],
];

/** Heuristic role category — used by the anonymizer. */
export function categorizeRole(role: string): string {
  const s = role.trim().toLowerCase();
  for (const [re, cat] of ROLE_CATEGORY_MAP) {
    if (re.test(s)) return cat;
  }
  return "Business";
}

export function categorizeSeniority(role: string): string {
  const s = role.trim().toLowerCase();
  for (const [key, label] of Object.entries(SENIORITY_MAP)) {
    if (s.includes(key)) return label;
  }
  return "Professional";
}

/**
 * Build the anonymized profile from the raw extracted data.
 * Deterministic, side-effect-free — safe to call on every write.
 */
export function anonymize(raw: CustomerRawProfile): CustomerAnonymizedProfile {
  const seniority =
    raw.seniority?.trim() || categorizeSeniority(raw.role || "");
  const roleCategory = categorizeRole(raw.role || raw.headline || "");

  // Bucket past projects into light categories so nothing identifies the
  // customer but partners can still see what kind of work they've done.
  const pastProjectCategories = dedup(
    raw.pastProjects.map((p) => categorizeProjectTopic(p)).filter(Boolean),
  );

  const maturitySignals: string[] = [];
  if (raw.expertise.some((e) => /cloud|aws|gcp|azure/i.test(e)))
    maturitySignals.push("Cloud-native experience");
  if (raw.expertise.some((e) => /kubernetes|k8s|terraform/i.test(e)))
    maturitySignals.push("Infrastructure automation");
  if (raw.expertise.some((e) => /ml|machine learning|ai|data science/i.test(e)))
    maturitySignals.push("ML/AI capability in-house");
  if (raw.expertise.some((e) => /sap/i.test(e)))
    maturitySignals.push("SAP workload");
  if (raw.careerHighlights.some((h) => /scale|scaled|millions/i.test(h)))
    maturitySignals.push("Has scaled before");

  return {
    seniority,
    roleCategory,
    expertise: dedup(
      raw.expertise
        .map((e) => e.trim())
        .filter(Boolean)
        .map(generalizeTechTag),
    ).slice(0, 15),
    industry: raw.company?.industry?.trim() || "Unspecified",
    companySize: raw.company?.size?.trim() || "Unspecified",
    companyRegion: raw.company?.region?.trim() || "Unspecified",
    goals: dedup(
      raw.goals.map((g) => stripIdentifiers(g)).filter(Boolean),
    ).slice(0, 8),
    pastProjectCategories,
    maturitySignals,
  };
}

function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/** Remove obvious identifiers from a free-text goal/project description. */
function stripIdentifiers(s: string): string {
  return s
    // Remove email addresses
    .replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, "[email]")
    // Remove URLs
    .replace(/https?:\/\/\S+/g, "[url]")
    // Remove phone-ish numbers
    .replace(/\b(?:\+?\d[\d\s().-]{6,}\d)\b/g, "[phone]")
    .trim();
}

/** Generalize concrete product names to categories to avoid fingerprinting. */
function generalizeTechTag(tag: string): string {
  const t = tag.toLowerCase();
  if (/snowflake|redshift|synapse/.test(t)) return "Cloud data warehouse";
  if (/bigquery/.test(t)) return "BigQuery";
  if (/postgres|mysql|oracle|sql server/.test(t))
    return "Relational database";
  if (/mongodb|cassandra|dynamodb/.test(t)) return "NoSQL database";
  if (/kafka|pubsub|kinesis/.test(t)) return "Streaming";
  if (/react|vue|angular/.test(t)) return "Web frontend";
  return tag;
}

function categorizeProjectTopic(text: string): string {
  const s = text.toLowerCase();
  if (/migrat/.test(s)) return "Cloud migration";
  if (/data (warehouse|lake|platform)|bi|analytics/.test(s))
    return "Data platform / analytics";
  if (/ml|machine learning|ai|model/.test(s)) return "ML / AI initiative";
  if (/security|compliance|iso|soc2|hipaa/.test(s))
    return "Security / compliance";
  if (/app modern|refactor|micro-?service/.test(s))
    return "Application modernization";
  if (/cost/.test(s)) return "Cost optimization";
  return "Platform project";
}

/**
 * Produce a short natural-language paragraph describing the customer the way
 * a partner will see it — no PII, no company name, no contact info.
 *
 * Example:
 *   "A global manufacturer in the energy industry with 1,000+ employees,
 *    led by engineering leadership at the VP / Director level. Focus areas
 *    include cloud-native migration and data platform modernization."
 */
export function buildAnonymizedNarrative(
  anon: CustomerAnonymizedProfile | null,
): string {
  if (!anon) {
    return "Customer context will be summarized here once the anonymized profile is available.";
  }

  const industry = cleanOrNull(anon.industry);
  const size = cleanOrNull(anon.companySize);
  const region = cleanOrNull(anon.companyRegion);
  const role = cleanOrNull(anon.roleCategory);
  const seniority = cleanOrNull(anon.seniority);

  // Sentence 1 — the company.
  const qualifier = region && region !== "Unspecified" ? `${region}-based` : "A";
  const industryPart = industry && industry !== "Unspecified" ? ` ${industry.toLowerCase()}` : "";
  const sizePart =
    size && size !== "Unspecified"
      ? ` with ${formatCompanySize(size)} employees`
      : "";
  const sentence1 =
    `${qualifier}${industryPart} organization${sizePart}.`.replace(
      /^A\s+organization/,
      "An organization",
    );

  // Sentence 2 — the person driving the initiative.
  const sentence2 =
    role && role !== "Business"
      ? `The initiative is led by ${role.toLowerCase()}${
          seniority ? ` at the ${seniority.toLowerCase()} level` : ""
        }.`
      : seniority
        ? `The initiative is led by a ${seniority.toLowerCase()}.`
        : "";

  // Sentence 3 — focus areas (goals or project categories).
  const focusSignals = [
    ...anon.goals.slice(0, 2).map((g) => g.toLowerCase()),
    ...anon.pastProjectCategories.slice(0, 2).map((p) => p.toLowerCase()),
  ];
  const uniqueFocus = Array.from(new Set(focusSignals)).slice(0, 3);
  const sentence3 =
    uniqueFocus.length > 0
      ? `Focus areas include ${joinWithAnd(uniqueFocus)}.`
      : "";

  // Sentence 4 — organizational maturity.
  const sentence4 =
    anon.maturitySignals.length > 0
      ? `Signals of organizational readiness: ${joinWithAnd(
          anon.maturitySignals.slice(0, 3).map((s) => s.toLowerCase()),
        )}.`
      : "";

  return [sentence1, sentence2, sentence3, sentence4]
    .filter(Boolean)
    .join(" ");
}

function cleanOrNull(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v.length ? v : null;
}

function formatCompanySize(size: string): string {
  // Input is usually a bucket like "1-10", "1000+", "501-1000"
  if (/\+/.test(size)) return size;
  if (/^\d+-\d+$/.test(size)) return size;
  return size;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
