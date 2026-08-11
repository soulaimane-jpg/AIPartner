/**
 * Seed and backfill the partner tag library.
 *
 * Three passes, all idempotent — safe to re-run after every deploy:
 *
 *   1. SEED     Upsert the canonical catalogue from src/lib/tag-seed.ts as
 *               status='global'. Labels and synonyms are refreshed; slugs
 *               are never touched (they are the identity).
 *   2. HARVEST  Scan the legacy JSON columns on PartnerProfile. Any value
 *               used by >= 3 distinct partners becomes a global tag; the
 *               rest land as 'pending' for admin review. This is the
 *               "Scrape & Seed the initial 80%" step, applied to the data
 *               we already have.
 *   3. BACKFILL Materialize PartnerTag rows from those same legacy columns
 *               so existing profiles carry their tags into the new model
 *               without anyone re-typing anything.
 *
 * The legacy columns are left intact. Nothing here is destructive.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/seed-tag-library.cjs
 *   DATABASE_URL=... node scripts/seed-tag-library.cjs --dry-run
 */
const { Client } = require("pg");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const DRY_RUN = process.argv.includes("--dry-run");

/** Promotion threshold — mirrors PROMOTION_THRESHOLD in src/lib/tags.ts. */
const HARVEST_THRESHOLD = 3;

/**
 * Legacy JSON column → its *intended* tag facet.
 *
 * "Intended" is doing real work here. `expertiseAreas` was meant for products
 * (BigQuery, Vertex AI, …), but `applyImport` dumped every specialization it
 * could not match against the old invented GCP_SPECIALIZATIONS list into it.
 * Real production data therefore contains verticals ("Financial Services"),
 * workloads ("Application Modernization") and specializations ("Security")
 * filed as products.
 *
 * Harvesting those at face value would fork a duplicate tag in the wrong
 * facet, so resolution is cross-facet — see `resolveAcrossFacets`.
 */
const LEGACY_COLUMN_FACETS = {
  specializations: { facet: "specialization", pillar: "positioning" },
  expertiseAreas: { facet: "product", pillar: "positioning" },
  industryExperience: { facet: "vertical", pillar: "positioning" },
};

/**
 * Facets a misfiled legacy value might legitimately belong to, best match
 * first. Only canonical (`global`) tags are eligible, so a partner-suggested
 * tag can never hijack another partner's value.
 */
const RECOVERY_FACETS = [
  "specialization",
  "workload",
  "vertical",
  "platform",
  "compliance",
  "product",
];

function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function genId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = require("node:crypto").randomBytes(24);
  let id = String.fromCharCode(97 + (bytes[0] % 26));
  for (let i = 1; i < 24; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

/**
 * Read the seed catalogue out of the TypeScript source.
 *
 * Parsing the object literals with a regex avoids adding a TS runtime to a
 * plain-node script, and avoids duplicating ~90 tag definitions in a second
 * file that would immediately drift. The shape is stable and fully under
 * our control, so this is a reasonable trade — it throws loudly if the file
 * stops matching.
 */
function loadSeedTags() {
  const src = readFileSync(
    join(__dirname, "..", "src", "lib", "tag-seed.ts"),
    "utf8",
  );

  const tags = [];
  const objectRe = /\{\s*slug:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*facet:\s*"([^"]+)",\s*pillar:\s*"([^"]+)"(?:,\s*synonyms:\s*\[([^\]]*)\])?\s*,?\s*\}/g;

  let m;
  while ((m = objectRe.exec(src)) !== null) {
    const [, slug, label, facet, pillar, rawSynonyms] = m;
    const synonyms = rawSynonyms
      ? rawSynonyms
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter(Boolean)
      : [];
    tags.push({ slug, label, facet, pillar, synonyms });
  }

  if (tags.length < 50) {
    throw new Error(
      `Parsed only ${tags.length} seed tags from tag-seed.ts — the file format ` +
        `probably changed. Refusing to seed a partial library.`,
    );
  }
  return tags;
}

async function seedCanonical(client, tags) {
  let inserted = 0;
  let refreshed = 0;

  for (const tag of tags) {
    const res = await client.query(
      `INSERT INTO "Tag" ("id","slug","label","facet","pillar","status","synonyms","useCount","suggestedByCount","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'global',$6,0,0,NOW(),NOW())
       ON CONFLICT ("facet", lower("slug")) DO UPDATE
         SET "label" = EXCLUDED."label",
             "synonyms" = EXCLUDED."synonyms",
             -- Promote anything a partner suggested that we have now
             -- blessed as canonical.
             "status" = 'global',
             "updatedAt" = NOW()
       RETURNING (xmax = 0) AS "isInsert"`,
      [
        genId(),
        tag.slug,
        tag.label,
        tag.facet,
        tag.pillar,
        JSON.stringify(tag.synonyms),
      ],
    );
    if (res.rows[0]?.isInsert) inserted++;
    else refreshed++;
  }

  return { inserted, refreshed };
}

/**
 * Build slug → {id, status} for a facet, including synonyms, so harvesting can
 * recognise "GCP" as the already-seeded "google-cloud-platform".
 *
 * Status rides along because cross-facet recovery only trusts canonical tags.
 */
async function buildResolver(client, facet) {
  const { rows } = await client.query(
    `SELECT "id","slug","status","synonyms" FROM "Tag"
     WHERE "facet" = $1 AND "mergedIntoId" IS NULL`,
    [facet],
  );
  const map = new Map();
  for (const r of rows) {
    const entry = { id: r.id, status: r.status };
    map.set(r.slug.toLowerCase(), entry);
    let syns = [];
    try {
      syns = JSON.parse(r.synonyms || "[]");
    } catch {
      syns = [];
    }
    // Synonyms never overwrite a real slug in the same facet.
    for (const s of syns) {
      const key = String(s).toLowerCase();
      if (!map.has(key)) map.set(key, entry);
    }
  }
  return map;
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Try `slug` in its intended facet, then in every recovery facet, accepting
 * only canonical tags outside the intended one.
 *
 * Returns `{ tagId, facet }` or null. The returned facet is the tag's real
 * facet, which is what gets written to `PartnerTag.facet` — so a value that
 * was misfiled as a product lands correctly as a vertical.
 */
function resolveAcrossFacets(slug, intendedFacet, resolvers) {
  const intended = resolvers[intendedFacet]?.get(slug);
  if (intended) return { tagId: intended.id, facet: intendedFacet };

  for (const facet of RECOVERY_FACETS) {
    if (facet === intendedFacet) continue;
    const hit = resolvers[facet]?.get(slug);
    if (hit && hit.status === "global") return { tagId: hit.id, facet };
  }
  return null;
}

async function harvestAndBackfill(client) {
  const profiles = await client.query(
    `SELECT "companyId", "specializations", "expertiseAreas", "industryExperience"
     FROM "PartnerProfile"`,
  );

  const stats = {
    harvestedGlobal: 0,
    harvestedPending: 0,
    recovered: 0,
    linksCreated: 0,
  };

  // One resolver per facet, shared across columns so recovery can see the
  // whole library rather than just the column's own facet.
  const resolvers = {};
  for (const facet of RECOVERY_FACETS) {
    resolvers[facet] = await buildResolver(client, facet);
  }

  for (const [column, { facet, pillar }] of Object.entries(
    LEGACY_COLUMN_FACETS,
  )) {
    // Count distinct partners per value that resolves nowhere at all.
    const usage = new Map();
    for (const row of profiles.rows) {
      for (const raw of parseJsonArray(row[column])) {
        const slug = slugify(raw);
        if (!slug) continue;
        if (resolveAcrossFacets(slug, facet, resolvers)) continue;
        const entry =
          usage.get(slug) ?? { label: raw.trim(), companies: new Set() };
        entry.companies.add(row.companyId);
        usage.set(slug, entry);
      }
    }

    for (const [slug, entry] of usage) {
      const partnerCount = entry.companies.size;
      const status = partnerCount >= HARVEST_THRESHOLD ? "global" : "pending";

      if (DRY_RUN) {
        if (status === "global") stats.harvestedGlobal++;
        else stats.harvestedPending++;
        continue;
      }

      const res = await client.query(
        `INSERT INTO "Tag" ("id","slug","label","facet","pillar","status","synonyms","useCount","suggestedByCount","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,'[]',0,$7,NOW(),NOW())
         ON CONFLICT ("facet", lower("slug")) DO NOTHING
         RETURNING "id"`,
        [genId(), slug, entry.label.slice(0, 80), facet, pillar, status, partnerCount],
      );
      if (res.rows[0]) {
        resolvers[facet].set(slug, { id: res.rows[0].id, status });
        if (status === "global") stats.harvestedGlobal++;
        else stats.harvestedPending++;
      }
    }

    // Materialize the join rows, using each tag's real facet.
    if (!DRY_RUN) {
      for (const row of profiles.rows) {
        for (const raw of parseJsonArray(row[column])) {
          const slug = slugify(raw);
          if (!slug) continue;
          const hit = resolveAcrossFacets(slug, facet, resolvers);
          if (!hit) continue;
          if (hit.facet !== facet) stats.recovered++;

          const res = await client.query(
            `INSERT INTO "PartnerTag" ("id","companyId","tagId","facet","createdAt")
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT ("companyId","tagId") DO NOTHING
             RETURNING "id"`,
            [genId(), row.companyId, hit.tagId, hit.facet],
          );
          if (res.rows[0]) stats.linksCreated++;
        }
      }
    }
  }

  return stats;
}

async function recountUsage(client) {
  await client.query(
    `UPDATE "Tag" t
     SET "useCount" = COALESCE(
       (SELECT COUNT(*) FROM "PartnerTag" pt WHERE pt."tagId" = t."id"), 0
     )`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const seedTags = loadSeedTags();
    console.log(`parsed ${seedTags.length} canonical tags from tag-seed.ts`);

    if (DRY_RUN) {
      console.log("\n-- DRY RUN: no writes --\n");
      const harvest = await harvestAndBackfill(client);
      console.log(`would harvest as global : ${harvest.harvestedGlobal}`);
      console.log(`would harvest as pending: ${harvest.harvestedPending}`);
      return;
    }

    const seeded = await seedCanonical(client, seedTags);
    console.log(`canonical tags inserted : ${seeded.inserted}`);
    console.log(`canonical tags refreshed: ${seeded.refreshed}`);

    const harvest = await harvestAndBackfill(client);
    console.log(`harvested as global     : ${harvest.harvestedGlobal}`);
    console.log(`harvested as pending    : ${harvest.harvestedPending}`);
    console.log(`recovered to right facet: ${harvest.recovered}`);
    console.log(`partner tag links created: ${harvest.linksCreated}`);

    await recountUsage(client);

    const { rows } = await client.query(
      `SELECT "facet", "status", COUNT(*)::int AS n
       FROM "Tag" GROUP BY "facet","status" ORDER BY "facet","status"`,
    );
    console.log("\nlibrary contents:");
    for (const r of rows) {
      console.log(`  ${r.facet.padEnd(18)} ${r.status.padEnd(8)} ${r.n}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
