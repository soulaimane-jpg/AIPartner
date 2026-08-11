import "server-only";

/**
 * Tag library service — the curated vocabulary behind partner profiles.
 *
 * Three rules keep the library from rotting into the "GCP / Google Cloud /
 * Google Cloud Platform" mess the feedback warns about:
 *
 *  1. **One canonical slug per facet.** Enforced by a unique index on
 *     `(facet, lower(slug))`, so casing can never fork a tag.
 *  2. **Synonyms resolve, they don't duplicate.** `resolveTag()` checks the
 *     synonym arrays before creating anything new.
 *  3. **Merges are soft.** `mergeTags()` sets `mergedIntoId` rather than
 *     deleting, so profiles pointing at the old tag still resolve.
 *
 * Partner-suggested tags land as `pending` and apply to the profile
 * immediately — the partner is never blocked waiting on an admin. Once three
 * independent partners suggest the same thing it is flagged for promotion.
 */

import { query, queryOne, exec, insertRow, genId } from "@/lib/db";
import type { TagRow } from "@/lib/db/rows";
import type { PillarKey, TagFacet } from "@/lib/partner-pillars";
import { safeJsonParse } from "@/lib/utils";

/** Suggestions needed before a pending tag is flagged for promotion. */
export const PROMOTION_THRESHOLD = 3;

export type TagStatus = "global" | "pending" | "rejected";

export interface Tag {
  id: string;
  slug: string;
  label: string;
  facet: TagFacet;
  pillar: PillarKey;
  status: TagStatus;
  synonyms: string[];
  useCount: number;
  suggestedByCount: number;
  mergedIntoId: string | null;
}

/**
 * Canonical form of a free-text tag: lowercase, punctuation stripped,
 * whitespace collapsed to single hyphens.
 *
 *   "Google Cloud Platform (GCP)" → "google-cloud-platform-gcp"
 *   "  SAP  on   GCP "            → "sap-on-gcp"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Delivery-mode qualifiers the Google Cloud partner directory appends to
 * specialization names. The library stores the bare concept.
 */
const DIRECTORY_QUALIFIERS = ["services", "training"] as const;

/**
 * Alternative spellings to try when a scraped label misses the library.
 *
 * The directory names its specializations with the delivery mode attached —
 * "Machine Learning – Services", "Infrastructure – Training", "Generative AI
 * Services" — while the tag library stores "Machine Learning",
 * "Infrastructure", "Generative AI". Without this every specialization on a
 * real GCP listing lands in the "not in our library" box.
 *
 * Comparison happens in slug space, so the en-dash the directory actually
 * emits, a plain hyphen and no separator at all all reduce to the same thing.
 * The input spelling is never returned — callers try that first.
 *
 *   "Machine Learning – Services" → ["machine-learning"]
 *   "Generative AI Services"      → ["generative-ai"]
 *   "Data Analytics"              → []
 */
export function directoryLabelVariants(input: string): string[] {
  const slug = slugify(input);
  if (!slug) return [];

  const out: string[] = [];
  for (const qualifier of DIRECTORY_QUALIFIERS) {
    if (!slug.endsWith(`-${qualifier}`)) continue;
    const base = slug.slice(0, -(qualifier.length + 1));
    if (base && !out.includes(base)) out.push(base);
  }
  return out;
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    facet: row.facet as TagFacet,
    pillar: row.pillar as PillarKey,
    status: row.status as TagStatus,
    synonyms: safeJsonParse<string[]>(row.synonyms, []),
    useCount: row.useCount,
    suggestedByCount: row.suggestedByCount,
    mergedIntoId: row.mergedIntoId,
  };
}

/**
 * Follow a merge chain to the surviving tag.
 *
 * Depth-capped: a cycle introduced by a bad admin merge would otherwise
 * spin forever, and returning the last tag we saw is strictly better than
 * hanging the request.
 */
async function followMerge(row: TagRow, depth = 0): Promise<TagRow> {
  if (!row.mergedIntoId || depth >= 5) return row;
  const next = await queryOne<TagRow>('SELECT * FROM "Tag" WHERE "id" = $1', [
    row.mergedIntoId,
  ]);
  return next ? followMerge(next, depth + 1) : row;
}

/**
 * Find an existing tag for `input` within `facet`, matching on canonical slug,
 * then the tag's own label, then any registered synonym. Returns null if
 * unknown.
 *
 * The label pass is not redundant with the slug pass. Slugs are globally
 * unique, so when two facets share a name the second one to be seeded gets a
 * qualified slug — the vertical "Education" is stored as `education-vertical`
 * because the specialization claimed `education`. Matching on slug alone made
 * that tag unreachable by its own name, so importing "Education" as an
 * industry always reported it missing. Comparing the stored label reduced to
 * slug form also absorbs punctuation drift, e.g. "Retail & E-Commerce" against
 * a stored `retail-ecommerce`.
 */
export async function resolveTag(
  facet: TagFacet,
  input: string,
): Promise<Tag | null> {
  const slug = slugify(input);
  if (!slug) return null;

  const direct = await queryOne<TagRow>(
    'SELECT * FROM "Tag" WHERE "facet" = $1 AND lower("slug") = $2',
    [facet, slug],
  );
  if (direct) return toTag(await followMerge(direct));

  // The tag's own label, reduced the same way `slugify` reduces the input.
  // Ranked above synonyms: a tag's real name should beat another tag's alias.
  const byLabel = await queryOne<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "facet" = $1
       AND btrim(lower(regexp_replace("label", '[^a-zA-Z0-9]+', '-', 'g')), '-') = $2
     LIMIT 1`,
    [facet, slug],
  );
  if (byLabel) return toTag(await followMerge(byLabel));

  // Synonym lookup. The arrays are small (a handful of spellings each) and
  // the candidate set is scoped to one facet, so a containment scan is
  // cheaper than maintaining a second table.
  const bySynonym = await queryOne<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "facet" = $1
       AND EXISTS (
         SELECT 1 FROM json_array_elements_text("synonyms"::json) AS s
         WHERE lower(s) = $2
       )
     LIMIT 1`,
    [facet, slug],
  );
  return bySynonym ? toTag(await followMerge(bySynonym)) : null;
}

/** All usable tags in a facet, most-used first. Excludes merged/rejected. */
export async function tagsForFacet(
  facet: TagFacet,
  { includePending = true }: { includePending?: boolean } = {},
): Promise<Tag[]> {
  const statuses = includePending ? ["global", "pending"] : ["global"];
  const rows = await query<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "facet" = $1 AND "status" = ANY($2) AND "mergedIntoId" IS NULL
     ORDER BY "status" = 'global' DESC, "useCount" DESC, "label" ASC`,
    [facet, statuses],
  );
  return rows.map(toTag);
}

/** Type-ahead over label, slug and synonyms within one facet. */
export async function searchTags(
  facet: TagFacet,
  term: string,
  limit = 20,
): Promise<Tag[]> {
  const trimmed = term.trim();
  if (!trimmed) return (await tagsForFacet(facet)).slice(0, limit);

  const like = `%${trimmed.toLowerCase()}%`;
  const rows = await query<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "facet" = $1
       AND "status" IN ('global', 'pending')
       AND "mergedIntoId" IS NULL
       AND (
         lower("label") LIKE $2
         OR lower("slug") LIKE $2
         OR EXISTS (
           SELECT 1 FROM json_array_elements_text("synonyms"::json) AS s
           WHERE lower(s) LIKE $2
         )
       )
     ORDER BY
       -- Prefix matches rank above substring matches.
       (lower("label") LIKE $3) DESC,
       "status" = 'global' DESC,
       "useCount" DESC
     LIMIT $4`,
    [facet, like, `${trimmed.toLowerCase()}%`, limit],
  );
  return rows.map(toTag);
}

/** Fetch many tags by id, preserving nothing about order. */
export async function tagsByIds(ids: string[]): Promise<Tag[]> {
  if (ids.length === 0) return [];
  const rows = await query<TagRow>('SELECT * FROM "Tag" WHERE "id" = ANY($1)', [
    ids,
  ]);
  return rows.map(toTag);
}

/**
 * Resolve `input` to a tag, creating a `pending` one if it is genuinely new.
 *
 * This is the "+ Suggest a tag" path. The tag is usable immediately; the
 * admin queue decides later whether it becomes canonical. `suggestedByCount`
 * only increments for tags that are still pending, so a long-established
 * global tag doesn't accumulate meaningless suggestion counts.
 */
export async function suggestTag({
  facet,
  pillar,
  label,
}: {
  facet: TagFacet;
  pillar: PillarKey;
  label: string;
}): Promise<Tag> {
  const cleanLabel = label.trim().slice(0, 80);
  const slug = slugify(cleanLabel);
  if (!slug) {
    throw new Error("Tag label must contain at least one letter or number.");
  }

  const existing = await resolveTag(facet, cleanLabel);
  if (existing) {
    if (existing.status === "pending") {
      await exec(
        `UPDATE "Tag"
         SET "suggestedByCount" = "suggestedByCount" + 1, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [existing.id],
      );
      return { ...existing, suggestedByCount: existing.suggestedByCount + 1 };
    }
    return existing;
  }

  // Two partners can race here; the unique index is the arbiter. On
  // conflict we re-read rather than failing the partner's save.
  try {
    const row = await insertRow<TagRow>("Tag", {
      slug,
      label: cleanLabel,
      facet,
      pillar,
      status: "pending",
      synonyms: "[]",
      useCount: 0,
      suggestedByCount: 1,
    });
    return toTag(row);
  } catch {
    const raced = await resolveTag(facet, cleanLabel);
    if (raced) return raced;
    throw new Error("Could not create that tag.");
  }
}

/** Pending tags at or above the promotion threshold, busiest first. */
export async function tagsAwaitingPromotion(): Promise<Tag[]> {
  const rows = await query<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "status" = 'pending' AND "suggestedByCount" >= $1
     ORDER BY "suggestedByCount" DESC, "useCount" DESC`,
    [PROMOTION_THRESHOLD],
  );
  return rows.map(toTag);
}

/** Every pending tag, for the admin review queue. */
export async function pendingTags(): Promise<Tag[]> {
  const rows = await query<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "status" = 'pending' AND "mergedIntoId" IS NULL
     ORDER BY "suggestedByCount" DESC, "useCount" DESC, "createdAt" ASC`,
  );
  return rows.map(toTag);
}

export async function promoteTag(tagId: string): Promise<void> {
  await exec(
    `UPDATE "Tag" SET "status" = 'global', "updatedAt" = NOW() WHERE "id" = $1`,
    [tagId],
  );
}

export async function rejectTag(tagId: string): Promise<void> {
  await exec(
    `UPDATE "Tag" SET "status" = 'rejected', "updatedAt" = NOW() WHERE "id" = $1`,
    [tagId],
  );
}

/**
 * Merge `sourceId` into `targetId`.
 *
 * Repoints every partner currently using the source, absorbs the source's
 * label and synonyms into the target's synonym list so future lookups of the
 * old spelling still land correctly, then marks the source merged. The source
 * row survives — anything holding a stale id keeps resolving.
 */
export async function mergeTags(
  sourceId: string,
  targetId: string,
): Promise<void> {
  if (sourceId === targetId) return;

  const [source, target] = await Promise.all([
    queryOne<TagRow>('SELECT * FROM "Tag" WHERE "id" = $1', [sourceId]),
    queryOne<TagRow>('SELECT * FROM "Tag" WHERE "id" = $1', [targetId]),
  ]);
  if (!source || !target) throw new Error("Tag not found.");
  if (source.facet !== target.facet) {
    throw new Error("Tags can only be merged within the same facet.");
  }

  // Move partners across, skipping any that already hold the target
  // (the unique index on (companyId, tagId) would reject those).
  await exec(
    `UPDATE "PartnerTag" SET "tagId" = $1
     WHERE "tagId" = $2
       AND NOT EXISTS (
         SELECT 1 FROM "PartnerTag" existing
         WHERE existing."companyId" = "PartnerTag"."companyId"
           AND existing."tagId" = $1
       )`,
    [targetId, sourceId],
  );
  await exec('DELETE FROM "PartnerTag" WHERE "tagId" = $1', [sourceId]);

  const merged = Array.from(
    new Set([
      ...safeJsonParse<string[]>(target.synonyms, []),
      ...safeJsonParse<string[]>(source.synonyms, []),
      source.slug,
    ]),
  );
  await exec(
    `UPDATE "Tag" SET "synonyms" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
    [JSON.stringify(merged), targetId],
  );
  await exec(
    `UPDATE "Tag"
     SET "mergedIntoId" = $1, "status" = 'rejected', "updatedAt" = NOW()
     WHERE "id" = $2`,
    [sourceId === targetId ? null : targetId, sourceId],
  );

  await recountTagUsage([targetId]);
}

/** Recompute `useCount` from the join table. Cheap; call after writes. */
export async function recountTagUsage(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  await exec(
    `UPDATE "Tag" t
     SET "useCount" = COALESCE((
       SELECT COUNT(*) FROM "PartnerTag" pt WHERE pt."tagId" = t."id"
     ), 0), "updatedAt" = NOW()
     WHERE t."id" = ANY($1)`,
    [tagIds],
  );
}

// ─── Partner ↔ tag assignment ─────────────────────────────────

/** Tag ids currently on a partner, grouped by facet. */
export async function partnerTagIdsByFacet(
  companyId: string,
): Promise<Record<string, string[]>> {
  const rows = await query<{ tagId: string; facet: string }>(
    'SELECT "tagId", "facet" FROM "PartnerTag" WHERE "companyId" = $1',
    [companyId],
  );
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.facet] ??= []).push(r.tagId);
  return out;
}

/** Full tag records on a partner, grouped by facet — for display. */
export async function partnerTagsByFacet(
  companyId: string,
): Promise<Record<string, Tag[]>> {
  const rows = await query<TagRow & { ptFacet: string }>(
    `SELECT t.*, pt."facet" AS "ptFacet"
     FROM "PartnerTag" pt
     JOIN "Tag" t ON t."id" = pt."tagId"
     WHERE pt."companyId" = $1
     ORDER BY t."label" ASC`,
    [companyId],
  );
  const out: Record<string, Tag[]> = {};
  for (const r of rows) (out[r.ptFacet] ??= []).push(toTag(r));
  return out;
}

/**
 * Replace a partner's tags for one facet.
 *
 * Scoped per facet so saving a single wizard step can't clear the others.
 * Diff-based rather than delete-all-then-insert: `createdAt` survives on
 * unchanged tags, which the freshness signals depend on.
 */
export async function setPartnerTags({
  companyId,
  facet,
  tagIds,
}: {
  companyId: string;
  facet: TagFacet;
  tagIds: string[];
}): Promise<void> {
  const desired = Array.from(new Set(tagIds));

  const current = await query<{ tagId: string }>(
    'SELECT "tagId" FROM "PartnerTag" WHERE "companyId" = $1 AND "facet" = $2',
    [companyId, facet],
  );
  const currentIds = current.map((r) => r.tagId);

  const toAdd = desired.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !desired.includes(id));

  if (toRemove.length > 0) {
    await exec(
      'DELETE FROM "PartnerTag" WHERE "companyId" = $1 AND "facet" = $2 AND "tagId" = ANY($3)',
      [companyId, facet, toRemove],
    );
  }

  for (const tagId of toAdd) {
    await exec(
      `INSERT INTO "PartnerTag" ("id", "companyId", "tagId", "facet", "createdAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("companyId", "tagId") DO NOTHING`,
      [genId(), companyId, tagId, facet],
    );
  }

  await recountTagUsage([...toAdd, ...toRemove]);
}
