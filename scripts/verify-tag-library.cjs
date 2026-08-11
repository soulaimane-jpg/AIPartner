/**
 * Post-seed verification for the tag library.
 *
 * Exercises the invariants that the anti-bloat design depends on, directly
 * against a seeded database. Read-only except for one create/merge round-trip
 * performed inside a transaction that is always rolled back.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/verify-tag-library.cjs
 */
const { Client } = require("pg");

function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  \u2713 ${name}`);
  } else {
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
    failures++;
  }
}

/** Mirrors resolveTag() in src/lib/tags.ts: slug first, then synonyms. */
async function resolve(client, facet, input) {
  const slug = slugify(input);
  if (!slug) return null;

  const direct = await client.query(
    `SELECT "id","slug","status" FROM "Tag"
     WHERE "facet" = $1 AND lower("slug") = $2`,
    [facet, slug],
  );
  if (direct.rows[0]) return direct.rows[0];

  const bySynonym = await client.query(
    `SELECT "id","slug","status" FROM "Tag"
     WHERE "facet" = $1
       AND EXISTS (
         SELECT 1 FROM json_array_elements_text("synonyms"::json) AS s
         WHERE lower(s) = $2
       )
     LIMIT 1`,
    [facet, slug],
  );
  return bySynonym.rows[0] ?? null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log("\nsynonym resolution");
    // The exact scenario the feedback warns about: four spellings, one tag.
    const gcpVariants = [
      "GCP",
      "Google Cloud",
      "google-cloud-platform",
      "Google Cloud Platform",
    ];
    const resolved = [];
    for (const v of gcpVariants) {
      const hit = await resolve(client, "platform", v);
      resolved.push(hit?.id ?? null);
    }
    check(
      "all four GCP spellings resolve to one tag",
      resolved.every((id) => id && id === resolved[0]),
      JSON.stringify(resolved),
    );

    const pciDash = await resolve(client, "compliance", "PCI-DSS");
    const pciPlain = await resolve(client, "compliance", "pci");
    check(
      "PCI-DSS and its synonym resolve together",
      pciDash && pciPlain && pciDash.id === pciPlain.id,
    );

    const pubsub = await resolve(client, "product", "Pub/Sub");
    check("punctuation-heavy label resolves (Pub/Sub)", Boolean(pubsub));

    console.log("\nfacet isolation");
    const secSpec = await resolve(client, "specialization", "Security");
    const secWorkload = await resolve(client, "workload", "Security & Compliance");
    check(
      "same word in two facets stays two tags",
      secSpec && secWorkload && secSpec.id !== secWorkload.id,
    );

    console.log("\nuniqueness guarantees");
    const dupes = await client.query(
      `SELECT "facet", lower("slug") AS s, COUNT(*)::int AS n
       FROM "Tag" GROUP BY "facet", lower("slug") HAVING COUNT(*) > 1`,
    );
    check("no duplicate slug within a facet", dupes.rows.length === 0);

    const caseConflict = await client.query(
      `INSERT INTO "Tag" ("id","slug","label","facet","pillar","status","synonyms","createdAt","updatedAt")
       VALUES ('verify_case_test','BIGQUERY','Bigquery dup','product','positioning','pending','[]',NOW(),NOW())
       ON CONFLICT ("facet", lower("slug")) DO NOTHING
       RETURNING "id"`,
    );
    check(
      "case-variant insert is rejected by the unique index",
      caseConflict.rows.length === 0,
    );

    console.log("\nreferential integrity");
    const orphans = await client.query(
      `SELECT COUNT(*)::int AS n FROM "PartnerTag" pt
       LEFT JOIN "Tag" t ON t."id" = pt."tagId" WHERE t."id" IS NULL`,
    );
    check("no orphaned PartnerTag rows", orphans.rows[0].n === 0);

    const facetMismatch = await client.query(
      `SELECT COUNT(*)::int AS n FROM "PartnerTag" pt
       JOIN "Tag" t ON t."id" = pt."tagId" WHERE t."facet" <> pt."facet"`,
    );
    check(
      "PartnerTag.facet always matches its Tag.facet",
      facetMismatch.rows[0].n === 0,
      `${facetMismatch.rows[0].n} mismatched`,
    );

    const badCounts = await client.query(
      `SELECT COUNT(*)::int AS n FROM "Tag" t
       WHERE t."useCount" <> (
         SELECT COUNT(*) FROM "PartnerTag" pt WHERE pt."tagId" = t."id"
       )`,
    );
    check("useCount matches the join table", badCounts.rows[0].n === 0);

    console.log("\nmerge round-trip (rolled back)");
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO "Tag" ("id","slug","label","facet","pillar","status","synonyms","createdAt","updatedAt")
         VALUES ('verify_src','verify-source','Verify Source','product','positioning','pending','[]',NOW(),NOW()),
                ('verify_tgt','verify-target','Verify Target','product','positioning','global','[]',NOW(),NOW())`,
      );
      await client.query(
        `UPDATE "Tag" SET "synonyms" = '["verify-source"]' WHERE "id" = 'verify_tgt'`,
      );
      await client.query(
        `UPDATE "Tag" SET "mergedIntoId" = 'verify_tgt', "status" = 'rejected'
         WHERE "id" = 'verify_src'`,
      );

      const merged = await client.query(
        `SELECT "mergedIntoId" FROM "Tag" WHERE "id" = 'verify_src'`,
      );
      check(
        "merged source keeps a pointer to the survivor",
        merged.rows[0].mergedIntoId === "verify_tgt",
      );

      const viaSynonym = await resolve(client, "product", "verify-source");
      check(
        "the old spelling still resolves after the merge",
        Boolean(viaSynonym),
      );
    } finally {
      await client.query("ROLLBACK");
    }

    const leaked = await client.query(
      `SELECT COUNT(*)::int AS n FROM "Tag" WHERE "id" LIKE 'verify_%'`,
    );
    check("verification rows left nothing behind", leaked.rows[0].n === 0);

    console.log(
      failures === 0
        ? "\nall checks passed\n"
        : `\n${failures} check(s) FAILED\n`,
    );
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
