import { describe, it, expect } from "vitest";
import {
  findMisfiledTags,
  suggestMisfile,
  tokenize,
  type MisfileCandidate,
} from "@/lib/tag-misfile";

/**
 * Fixtures are the *actual* production catalogue as of the Phase 0 backfill.
 * Using real strings matters: the exact-slug heuristic this replaced passed
 * plausible-looking synthetic tests while detecting nothing in production.
 */

const CANONICAL_VERTICALS = [
  "Education",
  "Energy & Utilities",
  "Financial Services",
  "Gaming",
  "Healthcare & Life Sciences",
  "Manufacturing & IoT",
  "Media & Entertainment",
  "Public Sector & Government",
  "Retail & E-Commerce",
  "SaaS / ISV",
  "Telecommunications",
  "Transport & Logistics",
];

/**
 * Included because omitting this facet is what let two false positives through
 * the first version of these tests: "Chrome Enterprise" and "Gemini Enterprise"
 * both matched "Work Transformation – Enterprise" on the shared qualifier.
 */
const CANONICAL_SPECIALIZATIONS = [
  "Application Development",
  "Cloud Migration",
  "Data Analytics",
  "Data Warehouse Modernization",
  "Education",
  "Infrastructure",
  "Machine Learning",
  "Marketing Analytics",
  "SAP on Google Cloud",
  "Security",
  "Training Services",
  "Work Transformation – Enterprise",
];

const CANONICAL_WORKLOADS = [
  "Application Modernization",
  "Cloud Migration / Infrastructure",
  "Data Platform Engineering",
  "Data Warehousing & Analytics",
  "DevOps & Platform Engineering",
  "Disaster Recovery & Resilience",
  "FinOps & Cost Optimization",
  "Generative AI / MLOps",
  "Mainframe Modernization",
  "Networking",
  "SAP Migration",
  "Security & Compliance",
];

/** The 18 pending tags the backfill actually produced. */
const PENDING: [string, string][] = [
  ["Artificial Intelligence", "product"],
  ["Business & Pro Services", "product"],
  ["Business & Professional Services", "vertical"],
  ["Chrome", "product"],
  ["Chrome Enterprise", "product"],
  ["Databases", "product"],
  ["Gemini Enterprise", "product"],
  ["Google Maps Platform", "product"],
  ["Google Workspace", "product"],
  ["Infrastructure Modernization", "product"],
  ["Manufacturing & Industrial", "product"],
  ["Maps", "product"],
  ["Public Sector & EDU", "product"],
  ["Retail & Consumer", "product"],
  ["Security Operations (SecOps)", "product"],
  ["Software & Internet", "product"],
  ["Software & Internet", "vertical"],
  ["Telecom, Media & Gaming", "product"],
];

function buildCatalogue(): MisfileCandidate[] {
  const tags: MisfileCandidate[] = [];
  let n = 0;
  const add = (label: string, facet: string, status: string) =>
    tags.push({ id: `t${n++}`, label, facet, status });

  for (const l of CANONICAL_VERTICALS) add(l, "vertical", "global");
  for (const l of CANONICAL_WORKLOADS) add(l, "workload", "global");
  for (const l of CANONICAL_SPECIALIZATIONS) add(l, "specialization", "global");
  for (const [label, facet] of PENDING) add(label, facet, "pending");
  return tags;
}

const catalogue = buildCatalogue();
const byLabelFacet = (label: string, facet: string) =>
  catalogue.find((t) => t.label === label && t.facet === facet)!;

describe("tokenize", () => {
  it("drops short and generic tokens", () => {
    expect(tokenize("Public Sector & EDU")).toEqual(["public", "sector"]);
    expect(tokenize("Google Cloud Services")).toEqual([]);
  });

  it("deduplicates", () => {
    expect(tokenize("Data Data Platform")).toEqual(["data"]);
  });
});

describe("real misfiled production tags", () => {
  const cases: [string, string][] = [
    ["Manufacturing & Industrial", "vertical"],
    ["Public Sector & EDU", "vertical"],
    ["Retail & Consumer", "vertical"],
    ["Business & Pro Services", "vertical"],
  ];

  for (const [label, expectedFacet] of cases) {
    it(`moves "${label}" out of product into ${expectedFacet}`, () => {
      const suggestion = suggestMisfile(
        byLabelFacet(label, "product"),
        catalogue,
      );
      expect(suggestion).not.toBeNull();
      expect(suggestion!.facet).toBe(expectedFacet);
    });
  }

  // These two are capability claims rather than products, but whether they
  // belong in `workload` or `specialization` is a judgement call — both are
  // defensible. Assert only that they get moved out of `product`.
  for (const label of [
    "Infrastructure Modernization",
    "Security Operations (SecOps)",
  ]) {
    it(`flags "${label}" as not a product`, () => {
      const suggestion = suggestMisfile(
        byLabelFacet(label, "product"),
        catalogue,
      );
      expect(suggestion).not.toBeNull();
      expect(suggestion!.facet).not.toBe("product");
    });
  }

  it("spots the cross-facet duplicate even though both sides are pending", () => {
    // "Software & Internet" exists as both a pending product and a pending
    // vertical. Requiring a canonical counterpart would hide this entirely.
    const suggestion = suggestMisfile(
      byLabelFacet("Software & Internet", "product"),
      catalogue,
    );
    expect(suggestion).not.toBeNull();
    expect(suggestion!.facet).toBe("vertical");
    expect(suggestion!.confidence).toBe(1);
  });
});

describe("genuine products are left alone", () => {
  for (const label of [
    "Chrome",
    "Chrome Enterprise",
    "Google Workspace",
    "Google Maps Platform",
    "Gemini Enterprise",
    "Maps",
    "Databases",
    "Artificial Intelligence",
  ]) {
    it(`does not flag "${label}"`, () => {
      expect(suggestMisfile(byLabelFacet(label, "product"), catalogue)).toBeNull();
    });
  }

  it("ignores generic tier qualifiers when matching", () => {
    // Regression: "Chrome Enterprise" and "Gemini Enterprise" were both matched
    // to the specialization "Work Transformation – Enterprise" purely on the
    // word "enterprise". Real-data verification caught this; the fixture-only
    // tests did not, because they omitted the specialization facet.
    expect(tokenize("Chrome Enterprise")).toEqual(["chrome"]);
    expect(tokenize("Work Transformation – Enterprise")).toEqual([
      "work",
      "transformation",
    ]);
  });
});

describe("cross-facet duplicates", () => {
  it("marks a token-identical pair as a duplicate", () => {
    // Same concept present in two facets. The fix is a merge, not just a move,
    // so the UI needs to distinguish this from an ordinary misfile.
    const suggestion = suggestMisfile(
      byLabelFacet("Software & Internet", "product"),
      catalogue,
    );
    expect(suggestion!.isDuplicate).toBe(true);
  });

  it("does not mark a merely-similar pair as a duplicate", () => {
    const suggestion = suggestMisfile(
      byLabelFacet("Manufacturing & Industrial", "product"),
      catalogue,
    );
    expect(suggestion!.isDuplicate).toBe(false);
  });
});

describe("findMisfiledTags", () => {
  const found = findMisfiledTags(catalogue);

  it("never flags a canonical tag", () => {
    for (const tag of catalogue) {
      if (tag.status === "global") expect(found.has(tag.id)).toBe(false);
    }
  });

  it("flags most of the pending backlog but not all of it", () => {
    // Sanity bounds. Flagging everything would be as useless as flagging
    // nothing — the previous exact-slug heuristic found zero.
    expect(found.size).toBeGreaterThanOrEqual(6);
    expect(found.size).toBeLessThan(PENDING.length);
  });

  it("never suggests the facet the tag is already in", () => {
    for (const [id, suggestion] of found) {
      const tag = catalogue.find((t) => t.id === id)!;
      expect(suggestion.facet).not.toBe(tag.facet);
    }
  });

  it("reports confidence within 0-1", () => {
    for (const [, s] of found) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("edge cases", () => {
  it("returns null for a label with no significant tokens", () => {
    const tag: MisfileCandidate = {
      id: "x",
      label: "AI",
      facet: "product",
      status: "pending",
    };
    expect(suggestMisfile(tag, catalogue)).toBeNull();
  });

  it("ignores rejected tags as suggestion targets", () => {
    const rejected: MisfileCandidate = {
      id: "r",
      label: "Manufacturing & IoT",
      facet: "vertical",
      status: "rejected",
    };
    const tag: MisfileCandidate = {
      id: "m",
      label: "Manufacturing Widgets",
      facet: "product",
      status: "pending",
    };
    expect(suggestMisfile(tag, [rejected, tag])).toBeNull();
  });

  it("never suggests against an empty catalogue", () => {
    expect(
      suggestMisfile(
        { id: "a", label: "Manufacturing", facet: "product", status: "pending" },
        [],
      ),
    ).toBeNull();
  });
});
