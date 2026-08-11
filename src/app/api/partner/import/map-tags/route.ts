/**
 * Resolve extracted label strings onto canonical tag ids.
 *
 * The extraction model returns human labels ("Financial Services", "GCP").
 * The pillar editor works in tag ids. This route bridges the two using the
 * same synonym-aware resolver the rest of the system uses, so an import lands
 * on exactly the tags a partner would have picked by hand.
 *
 * Unmatched labels are reported back rather than silently dropped — the wizard
 * shows them so the partner can decide whether to suggest them as new tags.
 * Silently discarding extracted data is how imports come to feel unreliable.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTagFacet, type TagFacet } from "@/lib/partner-pillars";
import { directoryLabelVariants, resolveTag } from "@/lib/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bound the work per request — imports are small, abuse would not be. */
const MAX_LABELS_PER_FACET = 40;

/**
 * Sibling facets to search when a label misses the facet it arrived under.
 *
 * The extraction model buckets labels the way the source page presents them,
 * which does not always agree with our facet boundaries: a Google Cloud
 * listing files "Machine Learning" and "Education" under expertise areas
 * (→ `product`) even though the library holds them as specializations, and
 * "Generative AI" as a workload. Searching only the declared facet reported
 * tags as missing that were sitting in the library the whole time.
 *
 * A hit found this way is recorded under the facet it matched in, never the
 * facet requested — otherwise a specialization tag id would be written into
 * the `products` field. Facets with a distinct, non-overlapping meaning
 * (vertical, compliance, platform…) deliberately have no fallbacks.
 */
const FACET_FALLBACKS: Partial<Record<TagFacet, TagFacet[]>> = {
  product: ["specialization", "workload"],
  specialization: ["workload", "product"],
  workload: ["specialization", "product"],
};

/** Facets to search for a label declared as `facet`, in priority order. */
function searchOrder(facet: TagFacet): TagFacet[] {
  return [facet, ...(FACET_FALLBACKS[facet] ?? [])];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.companyId || session.user.role !== "PARTNER") {
    return Response.json({ error: "Partner only" }, { status: 401 });
  }

  let body: { labelsByFacet?: Record<string, string[]> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const labelsByFacet = body.labelsByFacet ?? {};
  const matched: Record<string, { id: string; label: string }[]> = {};
  const unmatched: Record<string, string[]> = {};

  const addHit = (facet: TagFacet, tag: { id: string; label: string }) => {
    const bucket = (matched[facet] ??= []);
    if (!bucket.some((h) => h.id === tag.id)) {
      bucket.push({ id: tag.id, label: tag.label });
    }
  };

  for (const [facet, labels] of Object.entries(labelsByFacet)) {
    if (!isTagFacet(facet) || !Array.isArray(labels)) continue;

    // Ensure the field is cleared rather than left untouched when a facet
    // yields nothing, matching the previous contract.
    matched[facet] ??= [];
    const misses: string[] = [];

    for (const raw of labels.slice(0, MAX_LABELS_PER_FACET)) {
      if (typeof raw !== "string" || !raw.trim()) continue;

      // Exact spelling in the declared facet, then the same spelling in
      // sibling facets, then the directory's qualifier stripped, in that
      // order — most faithful interpretation first.
      const spellings = [raw, ...directoryLabelVariants(raw)];
      let hit: { facet: TagFacet; id: string; label: string } | null = null;

      for (const spelling of spellings) {
        for (const candidate of searchOrder(facet)) {
          const tag = await resolveTag(candidate, spelling);
          if (tag && tag.status !== "rejected") {
            hit = { facet: candidate, id: tag.id, label: tag.label };
            break;
          }
        }
        if (hit) break;
      }

      if (hit) addHit(hit.facet, { id: hit.id, label: hit.label });
      else misses.push(raw.trim());
    }

    if (misses.length > 0) unmatched[facet] = misses;
  }

  return Response.json({ ok: true, matched, unmatched });
}
