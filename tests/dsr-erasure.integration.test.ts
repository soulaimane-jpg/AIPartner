/**
 * GDPR erasure — REAL database integration test.
 *
 * Erasure is irreversible destruction of a person's data, so asserting on
 * the source text of the worker is not good enough: a typo'd column name
 * or a table that doesn't exist would pass a grep and fail in production,
 * mid-transaction, on a request we can never replay.
 *
 * This seeds a real user with real related rows, runs the real worker, and
 * checks what actually survived.
 *
 * Skipped unless DSR_IT_DATABASE_URL points at a throwaway database:
 *
 *   DSR_IT_DATABASE_URL=postgres://…/scratch npx vitest run tests/dsr-erasure.integration.test.ts
 *
 * NEVER point it at production — the test erases the rows it creates and
 * asserts on table contents.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const IT_URL = process.env.DSR_IT_DATABASE_URL;
const run = IT_URL ? describe : describe.skip;

// The worker emails the subject; capture instead of sending.
const sent: { toAddress: string; subject: string }[] = [];
vi.mock("@/lib/email/provider", () => ({
  sendEmail: (opts: { toAddress: string; subject: string }) => {
    sent.push(opts);
    return Promise.resolve({ ok: true });
  },
}));
vi.mock("@/lib/observability", () => ({
  captureError: () => undefined,
  captureWarning: () => undefined,
  redactContext: (x: unknown) => x,
}));

if (IT_URL) process.env.DATABASE_URL = IT_URL;

const U = "dsr_it_user";
const CO = "dsr_it_co";
const B = "dsr_it_brief";

run("fulfilErasure against a real database", () => {
  let db: typeof import("@/lib/db");
  let worker: typeof import("@/lib/jobs/dsr");

  beforeAll(async () => {
    db = await import("@/lib/db");
    worker = await import("@/lib/jobs/dsr");

    // Clean slate, then seed a subject with the related rows that matter.
    await db.exec('DELETE FROM "AuditLog" WHERE "actorId" = $1', [U]);
    await db.exec('DELETE FROM "DsrRequest" WHERE "userId" = $1', [U]);
    await db.exec('DELETE FROM "Comment" WHERE "authorId" = $1', [U]);
    await db.exec('DELETE FROM "Notification" WHERE "userId" = $1', [U]);
    await db.exec('DELETE FROM "AuthSession" WHERE "userId" = $1', [U]);
    await db.exec('DELETE FROM "ProjectBrief" WHERE "id" = $1', [B]);
    await db.exec('DELETE FROM "User" WHERE "id" = $1', [U]);
    await db.exec('DELETE FROM "Company" WHERE "id" = $1', [CO]);

    await db.exec(
      `INSERT INTO "Company" ("id","name","kind","updatedAt")
       VALUES ($1,'ACME','CUSTOMER',NOW())`,
      [CO],
    );
    await db.exec(
      `INSERT INTO "User"
         ("id","email","name","firstName","lastName","passwordHash","role",
          "jobTitle","location","companyId","googleId","image","emailVerified","updatedAt")
       VALUES ($1,'subject@acme.com','Jane Subject','Jane','Subject','$2yhash',
               'CUSTOMER','CTO','Dublin',$2,'google-123','https://img','2026-01-01',NOW())`,
      [U, CO],
    );
    await db.exec(
      `INSERT INTO "ProjectBrief" ("id","title","ownerId","companyId","updatedAt")
       VALUES ($1,'Migrate billing',$2,$3,NOW())`,
      [B, U, CO],
    );
    await db.exec(
      `INSERT INTO "Comment" ("id","briefId","sectionKey","authorId","body","updatedAt")
       VALUES ('dsr_it_c1',$1,'general',$2,'My name is Jane and my number is 555',NOW())`,
      [B, U],
    );
    await db.exec(
      `INSERT INTO "Notification" ("id","userId","type","title","message")
       VALUES ('dsr_it_n1',$1,'brief.triaged','T','M')`,
      [U],
    );
    await db.exec(
      `INSERT INTO "AuthSession" ("id","userId","tokenHash","expiresAt","userAgent")
       VALUES ('dsr_it_s1',$1,'hash-of-token',NOW() + interval '1 day','Mozilla')`,
      [U],
    );
    await db.exec(
      `INSERT INTO "AuditLog" ("id","actorId","kind","targetId","targetType","payload")
       VALUES ('dsr_it_a1',$1,'action.brief.submit',$2,'ProjectBrief','{}')`,
      [U, B],
    );
    await db.exec(
      `INSERT INTO "DsrRequest" ("id","userId","kind","status")
       VALUES ('dsr_it_req','${U}','erase','queued')`,
      [],
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.pool?.end?.();
  });

  it("completes and marks the request done", async () => {
    const result = await worker.fulfilErasure("dsr_it_req");
    expect(result.status).toBe("complete");

    const req = await db.queryOne<{ status: string; completedAt: Date | null }>(
      'SELECT "status","completedAt" FROM "DsrRequest" WHERE "id" = $1',
      ["dsr_it_req"],
    );
    expect(req?.status).toBe("complete");
    expect(req?.completedAt).not.toBeNull();
  }, 60_000);

  it("removes every identifying field from the User row", async () => {
    const u = await db.queryOne<Record<string, unknown>>(
      `SELECT "email","name","firstName","lastName","passwordHash","image",
              "jobTitle","location","googleId","emailVerified"
         FROM "User" WHERE "id" = $1`,
      [U],
    );
    expect(u).not.toBeNull();
    expect(String(u!.email)).toContain("@deleted.invalid");
    expect(String(u!.email)).not.toContain("acme.com");
    for (const col of [
      "name",
      "firstName",
      "lastName",
      "passwordHash",
      "image",
      "jobTitle",
      "location",
      "googleId",
      "emailVerified",
    ]) {
      expect(u![col], `${col} was not cleared`).toBeNull();
    }
  });

  it("revokes sessions and deletes notifications", async () => {
    expect(
      await db.count('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = $1', [U]),
    ).toBe(0);
    expect(
      await db.count('SELECT COUNT(*) FROM "Notification" WHERE "userId" = $1', [U]),
    ).toBe(0);
  });

  it("scrubs authored free text but keeps the row", async () => {
    const c = await db.queryOne<{ body: string }>(
      'SELECT "body" FROM "Comment" WHERE "id" = $1',
      ["dsr_it_c1"],
    );
    expect(c).not.toBeNull();
    expect(c!.body).not.toContain("Jane");
    expect(c!.body).not.toContain("555");
    expect(c!.body).toContain("erased");
  });

  it("RETAINS the audit trail — art. 5(2) accountability", async () => {
    const n = await db.count(
      'SELECT COUNT(*) FROM "AuditLog" WHERE "id" = $1',
      ["dsr_it_a1"],
    );
    expect(n).toBe(1);
  });

  it("records a completion audit event", async () => {
    const n = await db.count(
      `SELECT COUNT(*) FROM "AuditLog" WHERE "kind" = 'dsr.erase.completed'`,
    );
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("emails the original address, not the tombstone", async () => {
    // The confirmation must go to the address we are about to destroy.
    expect(
      sent.map((e) => e.toAddress),
      "no confirmation email captured",
    ).toContain("subject@acme.com");
    expect(sent.some((e) => e.toAddress.includes("deleted.invalid"))).toBe(false);
  });

  it("builds an export bundle without a SQL error", async () => {
    // Same bug class as the erasure path: every query here names columns
    // by hand, so a wrong name only shows up at runtime. (This caught two:
    // CookieConsent has no analytics/marketing, LegalAcceptance no
    // acceptedAt.)
    const { bundle, email } = await worker.buildExportBundle(U);
    expect(email).toBeTruthy();
    for (const key of [
      "subject",
      "briefs",
      "collaborations",
      "comments",
      "notifications",
      "npsResponses",
      "cookieConsents",
      "legalAcceptances",
      "sessions",
      "dsrHistory",
    ]) {
      expect(bundle, `bundle missing ${key}`).toHaveProperty(key);
    }
    expect(JSON.stringify(bundle)).not.toContain("hash-of-token");
  }, 60_000);

  it("is idempotent — a second run is a no-op, not a crash", async () => {
    const again = await worker.fulfilErasure("dsr_it_req");
    expect(again.status).toBe("complete");
    // Still exactly one user row, still tombstoned.
    const u = await db.queryOne<{ email: string }>(
      'SELECT "email" FROM "User" WHERE "id" = $1',
      [U],
    );
    expect(String(u!.email)).toContain("@deleted.invalid");
  }, 60_000);
});
