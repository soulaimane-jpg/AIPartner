/**
 * Detect tags sitting in the wrong facet.
 *
 * ## Why this is needed
 *
 * The legacy importer dumped anything it couldn't classify into the partner's
 * `expertiseAreas` column, which Phase 0 harvested into the `product` facet. In
 * production that left 16 of 18 pending tags misfiled — verticals like
 * "Manufacturing & Industrial" and workloads like "Infrastructure
 * Modernization" all filed as products.
 *
 * ## Why exact-slug matching isn't enough
 *
 * The obvious check — "does this slug already exist in another facet?" — finds
 * almost none of them, because the misfiled spellings differ from the canonical
 * ones ("Manufacturing & Industrial" vs. "Manufacturing & IoT", "Retail &
 * Consumer" vs. "Retail & E-Commerce"). Exact matching catches only true
 * duplicates, which is the rare case.
 *
 * So this compares *significant tokens* instead, using an overlap coefficient
 * rather than Jaccard: Jaccard punishes compound labels, scoring
 * "Manufacturing & Industrial" against "Manufacturing & IoT" at 0.5 when they
 * plainly denote the same industry.
 *
 * This only ever *suggests*. Facet changes are applied by an admin, because a
 * heuristic on marketing copy should not silently re-namespace live data.
 */

/** Tokens shorter than this carry too little signal to match on. */
const MIN_TOKEN_LENGTH = 4;

/**
 * Words common enough across the catalogue that sharing one means nothing.
 * Without these, every "… Services" tag looks like every other one.
 */
const STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "services",
  "service",
  "solutions",
  "solution",
  "platform",
  "google",
  "cloud",
  "other",
  // Generic product/tier qualifiers. Without these, "Chrome Enterprise" and
  // "Gemini Enterprise" — both genuine products — match the specialization
  // "Work Transformation – Enterprise" on the shared word alone.
  "enterprise",
  "general",
  "standard",
  "premium",
]);

/** Minimum overlap before a mismatch is worth an admin's attention. */
const SUGGEST_THRESHOLD = 0.5;

export interface MisfileCandidate {
  id: string;
  label: string;
  facet: string;
  status: string;
}

export interface MisfileSuggestion {
  /** Facet the tag probably belongs in. */
  facet: string;
  /** Closest existing tag in that facet. */
  nearestId: string;
  nearestLabel: string;
  nearestStatus: string;
  /** Overlap coefficient, 0-1. */
  confidence: number;
  /**
   * True when the two labels are token-identical, i.e. the same concept exists
   * in both facets. The fix is to merge rather than simply move, so the UI
   * words it differently.
   */
  isDuplicate: boolean;
}

/** Split a label into comparable, meaningful tokens. */
export function tokenize(label: string): string[] {
  return Array.from(
    new Set(
      label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t)),
    ),
  );
}

/**
 * Overlap coefficient: shared tokens over the smaller token set.
 *
 * Chosen over Jaccard because a specific label should still match a broader one
 * it is clearly a variant of. "Public Sector & EDU" vs. "Public Sector &
 * Government" scores 1.0 here and 0.67 under Jaccard.
 */
function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bs = new Set(b);
  const shared = a.filter((t) => bs.has(t)).length;
  return shared / Math.min(a.length, b.length);
}

/**
 * Suggest a better facet for `tag`, or null if it looks correctly filed.
 *
 * Compares against every tag in a *different* facet, including pending ones —
 * two pending duplicates of the same concept in different facets is exactly the
 * case an admin needs to see, and requiring a canonical counterpart would hide
 * it.
 */
export function suggestMisfile(
  tag: MisfileCandidate,
  allTags: MisfileCandidate[],
): MisfileSuggestion | null {
  const tokens = tokenize(tag.label);
  if (tokens.length === 0) return null;

  let best: MisfileSuggestion | null = null;

  for (const other of allTags) {
    if (other.id === tag.id) continue;
    if (other.facet === tag.facet) continue;
    if (other.status === "rejected") continue;

    const otherTokens = tokenize(other.label);
    const score = overlap(tokens, otherTokens);
    if (score < SUGGEST_THRESHOLD) continue;

    const duplicate =
      tokens.length === otherTokens.length &&
      tokens.every((t) => otherTokens.includes(t));

    // Prefer the strongest overlap; break ties toward canonical tags, since
    // moving into an established facet is the safer suggestion.
    const better =
      !best ||
      score > best.confidence ||
      (score === best.confidence &&
        other.status === "global" &&
        best.nearestStatus !== "global");

    if (better) {
      best = {
        facet: other.facet,
        nearestId: other.id,
        nearestLabel: other.label,
        nearestStatus: other.status,
        confidence: Number(score.toFixed(2)),
        isDuplicate: duplicate,
      };
    }
  }

  return best;
}

/** Run `suggestMisfile` across a whole catalogue. */
export function findMisfiledTags(
  allTags: MisfileCandidate[],
): Map<string, MisfileSuggestion> {
  const out = new Map<string, MisfileSuggestion>();
  for (const tag of allTags) {
    // Canonical tags are assumed deliberate; only unreviewed ones are checked.
    if (tag.status !== "pending") continue;
    const suggestion = suggestMisfile(tag, allTags);
    if (suggestion) out.set(tag.id, suggestion);
  }
  return out;
}
