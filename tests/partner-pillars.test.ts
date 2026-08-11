import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PILLARS,
  PILLAR_KEYS,
  PILLAR_FIELDS,
  TAG_FACETS,
  TOTAL_FIELD_WEIGHT,
  fieldsForPillar,
  pillarsInOrder,
  requiredFieldKeys,
  tagFields,
  isTagFacet,
} from "@/lib/partner-pillars";
import { SEED_TAGS } from "@/lib/tag-seed";
import {
  computeFreshness,
  computeProfileStrength,
  isFieldFilled,
  FRESHNESS_WINDOW_DAYS,
} from "@/lib/partner-strength";
import { slugify } from "@/lib/tags";

/**
 * Registry integrity. These are the invariants the whole feature rests on —
 * the wizard, the editor, validation and scoring all read this one map, so a
 * duplicate key or an orphaned pillar reference breaks every surface at once.
 */
describe("pillar field registry", () => {
  it("keys every field to its own map key", () => {
    for (const [key, field] of Object.entries(PILLAR_FIELDS)) {
      expect(field.key).toBe(key);
    }
  });

  it("assigns every field to a declared pillar", () => {
    for (const field of Object.values(PILLAR_FIELDS)) {
      expect(PILLAR_KEYS).toContain(field.pillar);
    }
  });

  it("has no duplicate ranks within a pillar", () => {
    for (const pillar of PILLAR_KEYS) {
      const ranks = fieldsForPillar(pillar).map((f) => f.rank);
      expect(new Set(ranks).size).toBe(ranks.length);
    }
  });

  it("orders pillars deterministically", () => {
    const ranks = pillarsInOrder().map((p) => p.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("gives every pillar at least one field", () => {
    for (const pillar of PILLAR_KEYS) {
      expect(fieldsForPillar(pillar).length).toBeGreaterThan(0);
    }
  });

  it("declares a valid facet on every tag-backed field", () => {
    for (const field of tagFields()) {
      expect(isTagFacet(field.facet)).toBe(true);
    }
  });

  it("only uses the tags control when a facet is present", () => {
    for (const field of Object.values(PILLAR_FIELDS)) {
      if (field.control === "tags") expect(field.facet).toBeTruthy();
      else expect(field.facet).toBeUndefined();
    }
  });

  it("supplies options for every segmented and multi control", () => {
    for (const field of Object.values(PILLAR_FIELDS)) {
      if (field.control === "segmented" || field.control === "multi") {
        expect(field.options?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("caps multi-selects so partners cannot claim everything", () => {
    // The core worry in the feedback. Every unbounded selector is a place
    // a partner can tick all boxes and destroy comparability.
    for (const field of Object.values(PILLAR_FIELDS)) {
      if (field.control === "tags" || field.control === "multi") {
        expect(field.maxSelections).toBeGreaterThan(0);
      }
    }
  });

  it("uses positive weights throughout", () => {
    for (const field of Object.values(PILLAR_FIELDS)) {
      expect(field.weight).toBeGreaterThan(0);
    }
    expect(TOTAL_FIELD_WEIGHT).toBe(
      Object.values(PILLAR_FIELDS).reduce((s, f) => s + f.weight, 0),
    );
  });

  it("keeps the required set small enough to finish in one sitting", () => {
    // The feedback's whole premise is 3–5 minutes, not 30–45.
    const required = requiredFieldKeys();
    expect(required.length).toBeGreaterThan(0);
    expect(required.length).toBeLessThanOrEqual(8);
  });
});

describe("tag seed catalogue", () => {
  it("has no duplicate slug within a facet", () => {
    const seen = new Set<string>();
    for (const tag of SEED_TAGS) {
      const key = `${tag.facet}::${tag.slug.toLowerCase()}`;
      expect(seen.has(key), `duplicate seed tag ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("uses already-canonical slugs", () => {
    // If slugify() would rewrite a seed slug, the DB lookup on
    // lower(slug) silently misses and the tag becomes unreachable.
    for (const tag of SEED_TAGS) {
      expect(slugify(tag.slug), `seed slug ${tag.slug} is not canonical`).toBe(
        tag.slug,
      );
    }
  });

  it("never lets a synonym collide with a real slug in the same facet", () => {
    // A synonym that equals another tag's slug makes resolution ambiguous.
    const slugsByFacet = new Map<string, Set<string>>();
    for (const tag of SEED_TAGS) {
      const set = slugsByFacet.get(tag.facet) ?? new Set<string>();
      set.add(tag.slug.toLowerCase());
      slugsByFacet.set(tag.facet, set);
    }
    for (const tag of SEED_TAGS) {
      for (const syn of tag.synonyms ?? []) {
        const collides = slugsByFacet.get(tag.facet)?.has(syn.toLowerCase());
        expect(collides, `synonym "${syn}" collides with a slug in ${tag.facet}`).toBeFalsy();
      }
    }
  });

  it("declares only known facets and pillars", () => {
    for (const tag of SEED_TAGS) {
      expect(TAG_FACETS).toContain(tag.facet);
      expect(PILLAR_KEYS).toContain(tag.pillar);
    }
  });

  it("covers every facet referenced by a tag field", () => {
    const seeded = new Set(SEED_TAGS.map((t) => t.facet));
    for (const field of tagFields()) {
      expect(seeded.has(field.facet), `no seed tags for facet ${field.facet}`).toBe(
        true,
      );
    }
  });

  it("replaces the invented specializations with Google's real taxonomy", () => {
    // Regression: the old GCP_SPECIALIZATIONS list contained names no
    // partner directory returns, so imports never matched.
    const specSlugs = SEED_TAGS.filter((t) => t.facet === "specialization").map(
      (t) => t.slug,
    );
    expect(specSlugs).toContain("data-analytics");
    expect(specSlugs).toContain("cloud-migration");
    expect(specSlugs).toContain("work-transformation-enterprise");
    expect(specSlugs).not.toContain("generative-ai-nodes");
    expect(specSlugs).not.toContain("zero-trust-security");
  });

  it("keeps the parser contract the seed script depends on", () => {
    // scripts/seed-tag-library.cjs regex-parses this file. If the literal
    // shape drifts, seeding silently under-populates the library.
    const src = readFileSync(
      join(process.cwd(), "src", "lib", "tag-seed.ts"),
      "utf8",
    );
    const re =
      /\{\s*slug:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*facet:\s*"([^"]+)",\s*pillar:\s*"([^"]+)"(?:,\s*synonyms:\s*\[([^\]]*)\])?\s*,?\s*\}/g;
    const parsed = [...src.matchAll(re)];
    expect(parsed.length).toBe(SEED_TAGS.length);
  });
});

describe("slugify", () => {
  it("collapses the GCP spelling variants onto one canonical form", () => {
    expect(slugify("Google Cloud Platform")).toBe("google-cloud-platform");
    expect(slugify("  SAP  on   GCP ")).toBe("sap-on-gcp");
    expect(slugify("PCI-DSS")).toBe("pci-dss");
  });

  it("strips punctuation and accents", () => {
    expect(slugify("Pub/Sub")).toBe("pub-sub");
    expect(slugify("Work Transformation – Enterprise")).toBe(
      "work-transformation-enterprise",
    );
    expect(slugify("Café Ops")).toBe("cafe-ops");
  });

  it("returns empty for input with nothing to slug", () => {
    expect(slugify("   ")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("is idempotent", () => {
    const once = slugify("Data Warehouse Modernization");
    expect(slugify(once)).toBe(once);
  });
});

describe("profile strength", () => {
  const filled = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const field of Object.values(PILLAR_FIELDS)) {
      switch (field.control) {
        case "tags":
        case "multi":
          out[field.key] = ["a"];
          break;
        case "repeater":
          out[field.key] = [{ name: "Landing Zone Kit" }];
          break;
        case "ratio":
          out[field.key] = 70;
          break;
        case "range":
          out[field.key] = { low: 1, high: 3 };
          break;
        default:
          out[field.key] = "value";
      }
    }
    return out;
  };

  it("scores an empty profile at zero and a full one at 100", () => {
    expect(computeProfileStrength({}).score).toBe(0);
    expect(computeProfileStrength(filled()).score).toBe(100);
  });

  it("reports no next action once complete", () => {
    const result = computeProfileStrength(filled());
    expect(result.nextBestAction).toBeNull();
    expect(result.missing).toHaveLength(0);
    expect(result.readyToComplete).toBe(true);
  });

  it("surfaces required gaps ahead of heavier optional ones", () => {
    const values = filled();
    // workloads is required (w12); caseStudies is optional but heavier (w14).
    delete values.workloads;
    delete values.caseStudies;

    const result = computeProfileStrength(values);
    expect(result.missing[0]?.key).toBe("workloads");
    expect(result.nextBestAction).toContain("Required:");
    expect(result.readyToComplete).toBe(false);
  });

  it("ranks optional gaps by weight", () => {
    const values = filled();
    delete values.caseStudies; // weight 14
    delete values.products; // weight 5

    const result = computeProfileStrength(values);
    expect(result.missing.map((m) => m.key)).toEqual(["caseStudies", "products"]);
  });

  it("projects the score the partner reaches after the next action", () => {
    const values = filled();
    delete values.referenceAvailability; // weight 8
    const result = computeProfileStrength(values);
    expect(result.nextBestAction).toMatch(/reach 100%/);
  });

  it("tracks completeness per pillar independently", () => {
    const values = filled();
    for (const field of fieldsForPillar("commercials")) delete values[field.key];

    const result = computeProfileStrength(values);
    const commercials = result.perPillar.find((p) => p.key === "commercials");
    const proof = result.perPillar.find((p) => p.key === "proof");

    expect(commercials?.percent).toBe(0);
    expect(commercials?.complete).toBe(false);
    expect(proof?.percent).toBe(100);
  });

  it("blocks completion only on required fields", () => {
    const values = filled();
    delete values.caseStudies; // optional
    expect(computeProfileStrength(values).readyToComplete).toBe(true);

    delete values.platforms; // required
    expect(computeProfileStrength(values).readyToComplete).toBe(false);
  });
});

describe("isFieldFilled", () => {
  const tagField = PILLAR_FIELDS.workloads;
  const repeaterField = PILLAR_FIELDS.ipAssets;
  const textField = PILLAR_FIELDS.resellPlatforms;
  const ratioField = PILLAR_FIELDS.seniorityRatio;

  it("rejects null, undefined and empty collections", () => {
    expect(isFieldFilled(tagField, null)).toBe(false);
    expect(isFieldFilled(tagField, undefined)).toBe(false);
    expect(isFieldFilled(tagField, [])).toBe(false);
    expect(isFieldFilled(textField, "")).toBe(false);
    expect(isFieldFilled(textField, "   ")).toBe(false);
  });

  it("accepts a non-empty tag selection", () => {
    expect(isFieldFilled(tagField, ["tag_1"])).toBe(true);
  });

  it("requires repeater entries to carry real content", () => {
    expect(isFieldFilled(repeaterField, [{}])).toBe(false);
    expect(isFieldFilled(repeaterField, [{ name: "" }])).toBe(false);
    expect(isFieldFilled(repeaterField, [{ name: "Terraform Kit" }])).toBe(true);
  });

  it("treats an explicit zero ratio as answered", () => {
    expect(isFieldFilled(ratioField, 0)).toBe(true);
    expect(isFieldFilled(ratioField, 75)).toBe(true);
    expect(isFieldFilled(ratioField, Number.NaN)).toBe(false);
  });
});

describe("freshness", () => {
  const now = new Date("2026-08-09T12:00:00Z");

  it("reports never for an unverified profile", () => {
    expect(computeFreshness(null, now).state).toBe("never");
    expect(computeFreshness(null, now).label).toBeNull();
  });

  it("labels a recent verification with its quarter", () => {
    const result = computeFreshness(new Date("2026-07-20T00:00:00Z"), now);
    expect(result.state).toBe("fresh");
    expect(result.label).toBe("Verified Active: Q3 2026");
  });

  it("goes stale past the six-month window", () => {
    const justInside = new Date(
      now.getTime() - (FRESHNESS_WINDOW_DAYS - 1) * 86_400_000,
    );
    const justOutside = new Date(
      now.getTime() - (FRESHNESS_WINDOW_DAYS + 1) * 86_400_000,
    );
    expect(computeFreshness(justInside, now).state).toBe("fresh");
    expect(computeFreshness(justOutside, now).state).toBe("stale");
  });

  it("maps calendar months onto the right quarter", () => {
    expect(computeFreshness(new Date("2026-01-15T00:00:00Z"), now).label).toBe(
      "Verified Active: Q1 2026",
    );
    expect(computeFreshness(new Date("2026-12-31T00:00:00Z"), now).label).toBe(
      "Verified Active: Q4 2026",
    );
  });

  it("handles an unparseable timestamp without throwing", () => {
    expect(computeFreshness("not-a-date", now).state).toBe("never");
  });
});
