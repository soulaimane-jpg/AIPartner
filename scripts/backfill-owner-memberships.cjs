/**
 * One-time backfill: companies created before the OWNER-membership fix have
 * no WorkspaceMembership row for their creator, so the owner cannot invite
 * members. For every company that has CUSTOMER users but no ACTIVE OWNER,
 * insert an OWNER membership for the earliest-created CUSTOMER user.
 * Idempotent (ON CONFLICT DO NOTHING).
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/backfill-owner-memberships.cjs
 */
const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: url });
  await client.connect();

  const missing = await client.query(
    `SELECT count(*)::int AS n FROM "Company" c
     WHERE EXISTS (SELECT 1 FROM "User" u WHERE u."companyId" = c.id AND u."role" = 'CUSTOMER')
       AND NOT EXISTS (SELECT 1 FROM "WorkspaceMembership" m
         WHERE m."companyId" = c.id AND m."role" = 'OWNER' AND m."status" = 'ACTIVE')`,
  );

  const res = await client.query(
    `INSERT INTO "WorkspaceMembership" ("id","companyId","userId","role","status","joinedAt","updatedAt")
     SELECT DISTINCT ON (c.id) gen_random_uuid()::text, c.id, u.id, 'OWNER', 'ACTIVE', u."createdAt", now()
     FROM "Company" c
     JOIN "User" u ON u."companyId" = c.id AND u."role" = 'CUSTOMER'
     WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceMembership" m
       WHERE m."companyId" = c.id AND m."role" = 'OWNER' AND m."status" = 'ACTIVE')
     ORDER BY c.id, u."createdAt" ASC
     ON CONFLICT DO NOTHING`,
  );

  console.log(`companies missing an active OWNER: ${missing.rows[0].n}`);
  console.log(`OWNER memberships inserted: ${res.rowCount}`);
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
