"use server";

/**
 * Admin tag-library curation.
 *
 * Four operations, and the fourth is here because of what the Phase 0 backfill
 * actually found in production data:
 *
 *   - **promote** — bless a partner suggestion as canonical.
 *   - **reject** — hide a suggestion from future pickers.
 *   - **merge** — collapse a duplicate into its canonical twin, capturing the
 *     old spelling as a synonym so existing references keep resolving.
 *   - **refacet** — move a tag into the correct facet.
 *
 * `refacet` was not in the original plan. Harvesting the legacy
 * `expertiseAreas` column surfaced verticals ("Financial Services"), workloads
 * ("Application Modernization") and specializations ("Security") all filed as
 * products, because the old importer dumped anything it couldn't match into that
 * column. Those tags aren't duplicates and aren't junk — they're correct values
 * in the wrong namespace, and neither promote, reject nor merge can fix that.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { exec, queryOne } from "@/lib/db";
import { invalidInput } from "@/lib/schemas/errors";
import { isTagFacet, PILLAR_FIELDS } from "@/lib/partner-pillars";
import {
  mergeTags,
  promoteTag,
  recountTagUsage,
  rejectTag,
} from "@/lib/tags";

const TagIdInput = z.object({ tagId: z.string().min(1) });

export const promoteTagAction = defineAction({
  name: "admin.tag.promote",
  input: TagIdInput,
  permission: "admin.tags.curate",
  rateLimit: { scope: "admin.tag.promote", limit: 200, windowSec: 60 },
  handler: async ({ tagId }) => {
    await promoteTag(tagId);
    revalidatePath("/admin/tags");
    return { ok: true as const };
  },
});

export const rejectTagAction = defineAction({
  name: "admin.tag.reject",
  input: TagIdInput,
  permission: "admin.tags.curate",
  rateLimit: { scope: "admin.tag.reject", limit: 200, windowSec: 60 },
  handler: async ({ tagId }) => {
    await rejectTag(tagId);
    revalidatePath("/admin/tags");
    return { ok: true as const };
  },
});

export const mergeTagsAction = defineAction({
  name: "admin.tag.merge",
  input: z.object({
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
  }),
  permission: "admin.tags.curate",
  rateLimit: { scope: "admin.tag.merge", limit: 100, windowSec: 60 },
  handler: async ({ sourceId, targetId }) => {
    if (sourceId === targetId) {
      fail(invalidInput("A tag cannot be merged into itself."));
    }
    try {
      await mergeTags(sourceId, targetId);
    } catch (err) {
      fail(
        invalidInput(
          err instanceof Error ? err.message : "Could not merge those tags.",
        ),
      );
    }
    revalidatePath("/admin/tags");
    return { ok: true as const };
  },
});

/**
 * Move a tag to a different facet.
 *
 * The facet is denormalized onto `PartnerTag` for read performance, so both
 * tables must move together — otherwise every partner holding this tag would
 * have a join row whose facet disagrees with the tag's, and per-facet reads
 * would silently drop it.
 *
 * Refuses when the destination already holds that slug: the operator wants
 * `merge`, and doing it implicitly here would hide a data decision inside what
 * looks like a rename.
 */
export const refacetTagAction = defineAction({
  name: "admin.tag.refacet",
  input: z.object({
    tagId: z.string().min(1),
    facet: z.string().min(1),
  }),
  permission: "admin.tags.curate",
  rateLimit: { scope: "admin.tag.refacet", limit: 100, windowSec: 60 },
  handler: async ({ tagId, facet }) => {
    if (!isTagFacet(facet)) {
      fail(invalidInput("Unknown facet.", "facet"));
    }

    const tag = await queryOne<{ id: string; slug: string; facet: string }>(
      'SELECT "id","slug","facet" FROM "Tag" WHERE "id" = $1',
      [tagId],
    );
    if (!tag) fail({ code: "NOT_FOUND", resource: "Tag" });
    if (tag!.facet === facet) return { ok: true as const };

    const clash = await queryOne<{ id: string }>(
      'SELECT "id" FROM "Tag" WHERE "facet" = $1 AND lower("slug") = lower($2)',
      [facet, tag!.slug],
    );
    if (clash) {
      fail(
        invalidInput(
          `"${tag!.slug}" already exists in ${facet}. Merge into it instead.`,
        ),
      );
    }

    // The pillar follows the facet — a vertical belongs to positioning even if
    // it was created while masquerading as a product.
    const owning = Object.values(PILLAR_FIELDS).find((f) => f.facet === facet);

    await exec(
      `UPDATE "Tag" SET "facet" = $1, "pillar" = $2, "updatedAt" = NOW() WHERE "id" = $3`,
      [facet, owning?.pillar ?? "positioning", tagId],
    );
    await exec(
      `UPDATE "PartnerTag" SET "facet" = $1 WHERE "tagId" = $2`,
      [facet, tagId],
    );
    await recountTagUsage([tagId]);

    revalidatePath("/admin/tags");
    return { ok: true as const };
  },
});

/** Edit a tag's display label. The slug — its identity — never changes. */
export const renameTagAction = defineAction({
  name: "admin.tag.rename",
  input: z.object({
    tagId: z.string().min(1),
    label: z.string().trim().min(2).max(80),
  }),
  permission: "admin.tags.curate",
  rateLimit: { scope: "admin.tag.rename", limit: 200, windowSec: 60 },
  handler: async ({ tagId, label }) => {
    await exec(
      `UPDATE "Tag" SET "label" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      [label, tagId],
    );
    revalidatePath("/admin/tags");
    return { ok: true as const };
  },
});
