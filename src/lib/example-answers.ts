/**
 * Inline "great answer" examples shown beneath assistant questions in the
 * AI brief chat. Each entry is detected via simple regexes against the
 * assistant's message — when one matches, the UI surfaces a small
 * "Show example" link that expands into an exemplar response plus a
 * "why it's good" rubric.
 *
 * Keep matchers narrow and tone-friendly. Each topic appears at most once.
 */

export type ExampleAnswer = {
  /** Unique stable key — also used as anchor/expanded id in the UI */
  key: string;
  /** Topic label shown in the "Show example" link */
  label: string;
  /** Regular expressions that fire when an assistant message contains them */
  matchers: RegExp[];
  /** The exemplar answer the user could give */
  exemplar: string;
  /** Bullet rubric explaining what makes the exemplar strong */
  whyItsGood: string[];
};

export const EXAMPLE_ANSWERS: ExampleAnswer[] = [
  {
    key: "executive-summary",
    label: "Crafting a strong executive summary",
    matchers: [
      /executive summary/i,
      /briefly describe.*project/i,
      /in one or two sentences/i,
      /high.level overview/i,
      /what business outcome/i,
      /(business )?(problem|challenge) (are you|you'?re) (trying to )?solv/i,
      /why is (this|it) important now/i,
    ],
    exemplar:
      "We're migrating our customer analytics workloads from on-prem Vertica to BigQuery to halve dashboard latency for our 200-strong commercial team. We need a partner certified in GCP Data Analytics with healthcare experience (HIPAA-equivalent controls). Target go-live: 31 March 2026, with a 6-month runway and €280-360k budget envelope.",
    whyItsGood: [
      "Specific source & target tech (Vertica → BigQuery)",
      "Quantified outcome ('halve dashboard latency')",
      "Names the audience, certification, timeline and budget",
    ],
  },
  {
    key: "success-criteria",
    label: "What good success criteria look like",
    matchers: [
      /success criteria/i,
      /measure success/i,
      /\bKPIs?\b/,
      /what does success/i,
      /acceptance criteria/i,
      /how (will|would) you know (it|this) (is |was )?(a )?success/i,
    ],
    exemplar:
      "(1) p95 dashboard query latency ≤ 4 s by week 8; (2) zero data-residency incidents in the EU region for 90 days post-go-live; (3) self-service adoption — 70% of analysts running their own queries in BigQuery by month 4; (4) total ownership cost reduced 35% versus current Vertica baseline by year-end.",
    whyItsGood: [
      "Each KPI is quantitative and time-boxed",
      "Mix of technical (latency), business (adoption), and financial (cost) metrics",
      "Baseline named so the partner can prove the delta",
    ],
  },
  {
    key: "scope-requirements",
    label: "Sample scope & requirements",
    // Deliberately narrow: bare /scope/ or /requirements?/ matched nearly
    // every question and shadowed every other example below.
    matchers: [
      /\b(in|out of|out-of)[- ]scope\b/i,
      /scope of work/i,
      /what needs to be (built|migrated|delivered|done)/i,
      /technical needs/i,
      /which (workloads|environments|systems|applications)/i,
      /\bdeliverables\b/i,
    ],
    exemplar:
      "In-scope: migrate 47 Looker dashboards to BigQuery-native sources; rebuild 12 nightly ELT pipelines on Cloud Composer; implement column-level encryption for PHI fields. Out-of-scope: replacement of Salesforce reporting, mobile app analytics. Constraints: must keep ISO 27001 + retain EU-only data residency.",
    whyItsGood: [
      "Explicit in-scope and out-of-scope items prevent partner ambiguity",
      "Counts and named systems anchor the work to reality",
      "Constraints surfaced upfront save weeks of re-scoping",
    ],
  },
  {
    key: "data-sources",
    label: "How to describe your current stack",
    matchers: [
      /data sources?/i,
      /current (stack|environment|architecture)/i,
      /existing (system|setup|infrastructure)/i,
      /where (is|does) (the|your) data (live|sit|reside)/i,
    ],
    exemplar:
      "Primary: Vertica 11 on-prem (4 nodes, ~85 TB compressed). Secondary: PostgreSQL 14 for operational store (Cloud SQL). Streaming: Kafka 3.5 producing CDC from Salesforce + Stripe. BI: Looker (self-hosted), refreshed nightly via Airflow 2.7.",
    whyItsGood: [
      "Versions and scale numbers help partners size the work",
      "Distinguishes operational vs analytical stores",
      "Highlights the integration surface (CDC, BI) that affects effort",
    ],
  },
  {
    key: "timeline-budget",
    label: "Framing timeline & budget honestly",
    matchers: [
      /\btimeline\b/i,
      /target go.?live/i,
      /go.?live date/i,
      /\bdeadline\b/i,
      /\bbudget\b/i,
      /cost range/i,
      /when do you need (this|it)/i,
    ],
    exemplar:
      "Go-live: 31 March 2026 (hard — tied to fiscal-year reporting). Phased: discovery Jan, pilot Feb, migration Mar. Budget envelope: €280-360k including partner services + 6 months of run-rate GCP consumption. Open to fixed-fee or T&M proposals.",
    whyItsGood: [
      "States whether the date is hard or aspirational",
      "Phasing tells the partner where flex exists",
      "Commercial model preference upfront speeds negotiation",
    ],
  },
  {
    key: "stakeholders",
    label: "Mapping decision makers",
    matchers: [
      /stakeholders?/i,
      /decision[- ]?makers?/i,
      /who (will|are) (be )?involved/i,
      /who (signs|approves|decides|will sign)/i,
      /\b(approver|sponsor)\b/i,
    ],
    exemplar:
      "Executive sponsor: CTO. Technical lead: Head of Data Platform (final architecture sign-off). Business lead: VP Commercial (defines success criteria). Security: CISO + DPO must approve any PHI handling. Procurement: VP Finance — signs SoWs > €100k. Decision cadence: bi-weekly steering committee.",
    whyItsGood: [
      "Names every approval gate (technical, business, security, procurement)",
      "Includes a cadence so partners know how fast decisions can move",
      "Avoids surprise approvers showing up late in the process",
    ],
  },
  {
    key: "selection-criteria",
    label: "Picking selection criteria that filter well",
    matchers: [
      /selection criteria/i,
      /how (will|do) you (evaluate|choose|select)/i,
      /criteria for (choosing|selecting|evaluating)/i,
      /what matters most (in|when) .{0,40}partner/i,
      /looking for in a partner/i,
    ],
    exemplar:
      "Must-have: GCP Data Analytics specialization; 2+ prior healthcare-sector deployments; EU delivery presence. Nice-to-have: existing relationship with Looker product team; managed-service offering post-go-live. Will weigh: 40% technical fit, 30% delivery track record, 20% cost, 10% cultural fit.",
    whyItsGood: [
      "Splits must-have vs nice-to-have so the shortlist is filterable",
      "Weights help us rank apples-to-apples",
      "Doesn't pretend cost is the only factor",
    ],
  },
];

/**
 * Pull out the part of an assistant turn that is actually asking something.
 *
 * Replies typically open by acknowledging the previous answer ("Got it — so
 * you're moving off Vertica…") and only then ask the next question. Matching
 * against the whole message meant the acknowledgement's vocabulary chose the
 * example, so a question about stakeholders could surface the data-sources
 * exemplar. Falls back to the full text when there's no question mark.
 */
function extractQuestion(text: string): string {
  const questions = text.match(/[^.!?\n]*\?/g);
  return questions?.length ? questions.join(" ") : text;
}

/**
 * Find the single best-matching example for an assistant message, or null.
 *
 * Scores every candidate by how many of its matchers fire and picks the
 * strongest. Previously this returned the FIRST entry with any match, so
 * broadly-worded topics earlier in the array shadowed more precise ones
 * further down.
 */
export function findExampleForAssistantMessage(
  text: string,
): ExampleAnswer | null {
  if (!text || text.length < 8) return null;
  const question = extractQuestion(text);

  let best: ExampleAnswer | null = null;
  let bestScore = 0;
  for (const ex of EXAMPLE_ANSWERS) {
    const score = ex.matchers.reduce(
      (n, re) => n + (re.test(question) ? 1 : 0),
      0,
    );
    // Strictly greater keeps array order as the tie-breaker.
    if (score > bestScore) {
      bestScore = score;
      best = ex;
    }
  }
  return best;
}
