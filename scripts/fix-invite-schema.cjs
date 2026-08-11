/**
 * Fix for "Invites could not be saved": the invite INSERT uses
 * ON CONFLICT ("companyId", lower("email")) WHERE "status" = 'INVITED',
 * but the DB only has a plain ("companyId","email") partial unique index —
 * Postgres requires an exact expression match, so every insert failed.
 * Creates the missing expression index (idempotent) and prints the state.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/fix-invite-schema.cjs
 */
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
    statement_timeout: 20000,
  });
  await client.connect();

  const cols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='WorkspaceInvite' ORDER BY ordinal_position",
  );
  console.log("COLUMNS:", cols.rows.map((r) => r.column_name).join(", ") || "(TABLE MISSING)");

  const before = await client.query("SELECT indexdef FROM pg_indexes WHERE tablename='WorkspaceInvite'");
  before.rows.forEach((r) => console.log("BEFORE:", r.indexdef));

  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_companyId_lower_email_invited_key"
     ON "WorkspaceInvite" ("companyId", lower("email")) WHERE "status" = 'INVITED'`,
  );

  const after = await client.query("SELECT indexdef FROM pg_indexes WHERE tablename='WorkspaceInvite'");
  after.rows.forEach((r) => console.log("AFTER:", r.indexdef));
  await client.end();
  console.log("done");
}

main().catch((err) => {
  console.error("ERR:", err.message);
  process.exit(1);
});
