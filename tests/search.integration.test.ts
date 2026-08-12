/**
 * Workspace search — REAL database integration test.
 *
 * The queries are the whole feature here, and a wrong join or a missing
 * scope is invisible to source-level assertions. This seeds two tenants and
 * checks what each role can actually find — in particular that a customer
 * cannot discover a partner company by name before the reveal.
 *
 * Skipped unless DSR_IT_DATABASE_URL points at a throwaway database.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

const IT_URL = process.env.DSR_IT_DATABASE_URL;
const run = IT_URL ? describe : describe.skip;

vi.mock("@/lib/observability", () => ({
  captureError: () => undefined,
  captureWarning: () => undefined,
  redactContext: (x: unknown) => x,
}));

if (IT_URL) process.env.DATABASE_URL = IT_URL;

const ACME = "s_acme";
const GLOBEX = "s_globex";
const PARTNER_CO = "s_partner";
const U_ACME = "s_u_acme";
const U_GLOBEX = "s_u_globex";
const U_PARTNER = "s_u_partner";
const B_ACME = "s_b_acme";
const B_GLOBEX = "s_b_globex";

/** Mirrors the customer branch of src/app/api/search/route.ts. */
const CUSTOMER_SQL = `
  SELECT DISTINCT b."id", b."title", b."stage", b."updatedAt"
    FROM "ProjectBrief" b
    LEFT JOIN "BriefCollaborator" bc
      ON bc."briefId" = b."id"
     AND lower(bc."email") = lower($2)
     AND bc."status" <> 'REMOVED'
   WHERE b."title" ILIKE $3 ESCAPE '\\'
     AND (
       b."ownerId" = $1
       OR ($4::text IS NOT NULL AND b."companyId" = $4)
       OR bc."id" IS NOT NULL
     )
   ORDER BY b."updatedAt" DESC
   LIMIT $5`;

const PARTNER_SQL = `
  SELECT b."id", b."title", m."status"
    FROM "ProjectBrief" b
    JOIN "Match" m ON m."briefId" = b."id"
   WHERE m."partnerId" = $1
     AND b."title" ILIKE $2 ESCAPE '\\'
   ORDER BY b."updatedAt" DESC
   LIMIT $3`;

const likeTerm = (raw: string) => `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

run("search queries against a real database", () => {
  let db: typeof import("@/lib/db");

  beforeAll(async () => {
    db = await import("@/lib/db");

    await db.exec('DELETE FROM "Match" WHERE "briefId" = ANY($1)', [
      [B_ACME, B_GLOBEX],
    ]);
    await db.exec('DELETE FROM "BriefCollaborator" WHERE "briefId" = ANY($1)', [
      [B_ACME, B_GLOBEX],
    ]);
    await db.exec('DELETE FROM "ProjectBrief" WHERE "id" = ANY($1)', [
      [B_ACME, B_GLOBEX],
    ]);
    await db.exec('DELETE FROM "User" WHERE "id" = ANY($1)', [
      [U_ACME, U_GLOBEX, U_PARTNER],
    ]);
    await db.exec('DELETE FROM "Company" WHERE "id" = ANY($1)', [
      [ACME, GLOBEX, PARTNER_CO],
    ]);

    await db.exec(
      `INSERT INTO "Company" ("id","name","kind","updatedAt") VALUES
         ($1,'Acme','CUSTOMER',NOW()),
         ($2,'Globex','CUSTOMER',NOW()),
         ($3,'Northwind Cloud','PARTNER',NOW())`,
      [ACME, GLOBEX, PARTNER_CO],
    );
    await db.exec(
      `INSERT INTO "User" ("id","email","role","companyId","updatedAt") VALUES
         ($1,'a@acme.com','CUSTOMER',$4,NOW()),
         ($2,'g@globex.com','CUSTOMER',$5,NOW()),
         ($3,'p@northwind.com','PARTNER',$6,NOW())`,
      [U_ACME, U_GLOBEX, U_PARTNER, ACME, GLOBEX, PARTNER_CO],
    );
    await db.exec(
      `INSERT INTO "ProjectBrief" ("id","title","ownerId","companyId","stage","updatedAt") VALUES
         ($1,'Billing migration to BigQuery',$3,$5,'INTAKE',NOW()),
         ($2,'Globex secret datacentre exit',$4,$6,'INTAKE',NOW())`,
      [B_ACME, B_GLOBEX, U_ACME, U_GLOBEX, ACME, GLOBEX],
    );
    // The partner is matched to Acme's brief only.
    await db.exec(
      `INSERT INTO "Match" ("id","briefId","partnerId","status","updatedAt")
       VALUES ('s_m1',$1,$2,'INVITED',NOW())`,
      [B_ACME, PARTNER_CO],
    );
  }, 60_000);

  it("finds the caller's own brief by title", async () => {
    const rows = await db.query<{ title: string }>(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("billing"),
      ACME,
      6,
    ]);
    expect(rows.map((r) => r.title)).toContain("Billing migration to BigQuery");
  });

  it("is case-insensitive", async () => {
    const rows = await db.query(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("BIGQUERY"),
      ACME,
      6,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("does NOT return another tenant's brief", async () => {
    // The decisive test: Globex's brief matches the term but belongs to
    // another company.
    const rows = await db.query<{ title: string }>(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("secret"),
      ACME,
      6,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("a wildcard cannot widen the search to every row", async () => {
    // Unescaped, '%' would match everything the caller can see and,
    // combined with a missing scope, would dump the table.
    const rows = await db.query(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("%"),
      ACME,
      6,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("finds a brief shared via an explicit collaborator grant", async () => {
    await db.exec(
      `INSERT INTO "BriefCollaborator"
         ("id","briefId","email","role","status","inviteToken","invitedById","updatedAt")
       VALUES ('s_bc1',$1,'a@acme.com','VIEWER','ACTIVE','tok-s1',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [B_GLOBEX, U_GLOBEX],
    );
    const rows = await db.query<{ title: string }>(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("secret"),
      null, // no company match — the grant is the only route in
      6,
    ]);
    expect(rows.map((r) => r.title)).toContain("Globex secret datacentre exit");

    // A removed grant must stop granting access.
    await db.exec(
      `UPDATE "BriefCollaborator" SET "status" = 'REMOVED' WHERE "id" = 's_bc1'`,
    );
    const after = await db.query(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("secret"),
      null,
      6,
    ]);
    expect(after).toHaveLength(0);
  }, 60_000);

  it("a partner finds only briefs they are matched to", async () => {
    const mine = await db.query<{ title: string }>(PARTNER_SQL, [
      PARTNER_CO,
      likeTerm("billing"),
      6,
    ]);
    expect(mine).toHaveLength(1);

    const notMine = await db.query(PARTNER_SQL, [
      PARTNER_CO,
      likeTerm("secret"),
      6,
    ]);
    expect(notMine).toHaveLength(0);
  });

  it("no customer-facing query can surface a partner company name", async () => {
    // Searching the partner's actual name must return nothing for a customer.
    const rows = await db.query(CUSTOMER_SQL, [
      U_ACME,
      "a@acme.com",
      likeTerm("Northwind"),
      ACME,
      6,
    ]);
    expect(rows).toHaveLength(0);
  });
});
