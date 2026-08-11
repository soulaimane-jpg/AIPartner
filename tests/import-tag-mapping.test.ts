/**
 * Import tag resolution, against the real seeded tag library.
 *
 * The payload below is the exact set of labels a live Devoteam Google Cloud
 * listing produced, every one of which was reported as "not in our library
 * yet" even though most were sitting in the library under a slightly
 * different spelling or a neighbouring facet.
 *
 * Needs a seeded database, so it self-skips when the tag library is absent
 * (CI without Postgres) rather than failing for the wrong reason.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { directoryLabelVariants, resolveTag, tagsForFacet } from "@/lib/tags";
import type { TagFacet } from "@/lib/partner-pillars";

/** Mirrors FACET_FALLBACKS + resolution order in the map-tags route. */
const FACET_FALLBACKS: Partial<Record<TagFacet, TagFacet[]>> = {
  product: ["specialization", "workload"],
  specialization: ["workload", "product"],
  workload: ["specialization", "product"],
};

async function resolveLikeImport(
  facet: TagFacet,
  raw: string,
): Promise<{ facet: TagFacet; label: string } | null> {
  for (const spelling of [raw, ...directoryLabelVariants(raw)]) {
    for (const candidate of [facet, ...(FACET_FALLBACKS[facet] ?? [])]) {
      const tag = await resolveTag(candidate, spelling);
      if (tag && tag.status !== "rejected") {
        return { facet: candidate, label: tag.label };
      }
    }
  }
  return null;
}

// As scraped: the delivery-mode-qualified names arrive as specializations,
// the bare concepts as expertise areas (which route to `product`).
const SCRAPED: { facet: TagFacet; label: string }[] = [
  { facet: "specialization", label: "Generative AI Services" },
  { facet: "specialization", label: "Security – Services" },
  { facet: "specialization", label: "Infrastructure – Services" },
  { facet: "specialization", label: "Machine Learning – Services" },
  { facet: "specialization", label: "Data Analytics – Services" },
  { facet: "specialization", label: "Data Analytics – Training" },
  { facet: "specialization", label: "Application Development – Services" },
  { facet: "specialization", label: "Infrastructure – Training" },
  { facet: "product", label: "Education" },
  { facet: "product", label: "Machine Learning" },
  { facet: "product", label: "Generative AI" },
];

describe("directoryLabelVariants", () => {
  it("strips the directory's delivery-mode qualifier", () => {
    expect(directoryLabelVariants("Machine Learning – Services")).toEqual([
      "machine-learning",
    ]);
    expect(directoryLabelVariants("Infrastructure – Training")).toEqual([
      "infrastructure",
    ]);
    // No dash at all, as the directory also emits.
    expect(directoryLabelVariants("Generative AI Services")).toEqual([
      "generative-ai",
    ]);
  });

  it("leaves unqualified labels alone", () => {
    expect(directoryLabelVariants("Data Analytics")).toEqual([]);
    expect(directoryLabelVariants("Education")).toEqual([]);
  });

  it("never returns an empty slug", () => {
    expect(directoryLabelVariants("Services")).toEqual([]);
    expect(directoryLabelVariants("– Training")).toEqual([]);
    expect(directoryLabelVariants("")).toEqual([]);
  });
});

describe("import tag mapping against the real library", () => {
  let seeded = false;

  beforeAll(async () => {
    try {
      seeded = (await tagsForFacet("specialization")).length > 0;
    } catch {
      seeded = false;
    }
  });

  it("resolves every label a real GCP listing produced", async () => {
    if (!seeded) return; // no seeded DB available

    const misses: string[] = [];
    for (const { facet, label } of SCRAPED) {
      if (!(await resolveLikeImport(facet, label))) misses.push(label);
    }

    expect(misses).toEqual([]);
  });

  it("files each hit under the facet that actually owns it", async () => {
    if (!seeded) return;

    // Arrived as `product`, but these belong to other facets. Landing them in
    // `products` would write a specialization id into the wrong column.
    expect((await resolveLikeImport("product", "Education"))?.facet).toBe(
      "specialization",
    );
    expect((await resolveLikeImport("product", "Machine Learning"))?.facet).toBe(
      "specialization",
    );
    expect((await resolveLikeImport("product", "Generative AI"))?.facet).toBe(
      "workload",
    );
  });

  it("keeps the qualifier-stripped label pointing at the right concept", async () => {
    if (!seeded) return;

    expect(
      (await resolveLikeImport("specialization", "Machine Learning – Services"))
        ?.label,
    ).toBe("Machine Learning");
    expect(
      (await resolveLikeImport("specialization", "Infrastructure – Training"))
        ?.label,
    ).toBe("Infrastructure");
  });

  it("does not leak across facets that have no fallback", async () => {
    if (!seeded) return;

    // A workload term must never be accepted as an industry.
    expect(await resolveLikeImport("vertical", "Generative AI")).toBeNull();
  });
});

/**
 * Slugs are globally unique, so a tag whose name is taken by another facet is
 * stored under a qualified slug. Resolving on slug alone left those tags
 * unreachable by their own label — the case that made a real import report
 * industries as missing while they sat in the library.
 */
describe("resolveTag matches a tag by its own label", () => {
  let seeded = false;

  beforeAll(async () => {
    try {
      seeded = (await tagsForFacet("vertical")).length > 0;
    } catch {
      seeded = false;
    }
  });

  it("resolves a label whose slug was claimed by another facet", async () => {
    if (!seeded) return;

    // Stored as `education-vertical`; `education` belongs to the specialization.
    const tag = await resolveTag("vertical", "Education");
    expect(tag?.label).toBe("Education");
    expect(tag?.facet).toBe("vertical");
  });

  it("resolves labels whose slug is abbreviated or punctuated differently", async () => {
    if (!seeded) return;

    // Stored as `public-sector`, and `retail-ecommerce` vs a slugified
    // `retail-e-commerce`.
    expect(
      (await resolveTag("vertical", "Public Sector & Government"))?.label,
    ).toBe("Public Sector & Government");
    expect((await resolveTag("vertical", "Retail & E-Commerce"))?.label).toBe(
      "Retail & E-Commerce",
    );
  });

  it("still returns null for a label that is genuinely absent", async () => {
    if (!seeded) return;

    expect(
      await resolveTag("vertical", "Interplanetary Freight Brokerage"),
    ).toBeNull();
  });
});
