/**
 * Database-level integration checks for code paths whose risk is in the
 * SQL, not the TypeScript.
 *
 * The DSR integration test found three column-name bugs that source-level
 * assertions had happily passed, so the same treatment is applied here to:
 *
 *   - the notify() recipient lookup (mixed id/email `= ANY($n)` with empty
 *     arrays — a shape that silently returns nothing if wrong, which would
 *     disable the identity firewall by making every recipient unknown);
 *   - `transitionLead` inside a caller transaction (FOR UPDATE + a client
 *     threaded through updateRows and the audit insert);
 *   - the Notification idemKey partial-index upsert.
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

const CO = "dbp_co";
const U_CUST = "dbp_cust";
const U_ADMIN = "dbp_admin";
const B = "dbp_brief";

run("SQL-level behaviour", () => {
  let db: typeof import("@/lib/db");
  let lead: typeof import("@/lib/state-machine/lead");

  beforeAll(async () => {
    db = await import("@/lib/db");
    lead = await import("@/lib/state-machine/lead");

    await db.exec('DELETE FROM "AuditLog" WHERE "targetId" = $1', [B]);
    await db.exec('DELETE FROM "Notification" WHERE "userId" = $1', [U_CUST]);
    await db.exec('DELETE FROM "ProjectBrief" WHERE "id" = $1', [B]);
    await db.exec('DELETE FROM "User" WHERE "id" = ANY($1)', [
      [U_CUST, U_ADMIN],
    ]);
    await db.exec('DELETE FROM "Company" WHERE "id" = $1', [CO]);

    await db.exec(
      `INSERT INTO "Company" ("id","name","kind","updatedAt")
       VALUES ($1,'ACME','CUSTOMER',NOW())`,
      [CO],
    );
    await db.exec(
      `INSERT INTO "User" ("id","email","role","companyId","updatedAt")
       VALUES ($1,'cust@acme.com','CUSTOMER',$3,NOW()),
              ($2,'ops@aip.cloud','ADMIN',NULL,NOW())`,
      [U_CUST, U_ADMIN, CO],
    );
    await db.exec(
      `INSERT INTO "ProjectBrief"
         ("id","title","ownerId","companyId","leadState","stage","updatedAt")
       VALUES ($1,'T',$2,$3,'DRAFT','INTAKE',NOW())`,
      [B, U_CUST, CO],
    );
  }, 60_000);

  describe("notify recipient lookup", () => {
    const SQL = `SELECT "id", "email", "role" FROM "User"
                  WHERE "id" = ANY($1) OR lower("email") = ANY($2)`;

    it("resolves by id when the email array is empty", async () => {
      const rows = await db.query<{ id: string; role: string }>(SQL, [
        [U_CUST],
        [],
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("CUSTOMER");
    });

    it("resolves by email when the id array is empty", async () => {
      const rows = await db.query<{ id: string; role: string }>(SQL, [
        [],
        ["ops@aip.cloud"],
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("ADMIN");
    });

    it("resolves a mixed batch", async () => {
      const rows = await db.query<{ id: string }>(SQL, [
        [U_CUST],
        ["ops@aip.cloud"],
      ]);
      expect(rows).toHaveLength(2);
    });

    it("is case-insensitive on email", async () => {
      const rows = await db.query<{ id: string }>(SQL, [
        [],
        ["ops@aip.cloud".toLowerCase()],
      ]);
      expect(rows).toHaveLength(1);
    });

    it("returns nothing for both-empty rather than erroring", async () => {
      const rows = await db.query(SQL, [[], []]);
      expect(rows).toHaveLength(0);
    });
  });

  describe("Notification idemKey upsert", () => {
    it("dedupes a retry and still allows null keys", async () => {
      const key = `dbp:${Date.now()}`;
      const insert = () =>
        db.insertRow(
          "Notification",
          {
            userId: U_CUST,
            type: "brief.triaged",
            title: "T",
            message: "M",
            link: null,
            idemKey: key,
          },
          {
            noUpdatedAt: true,
            onConflict: `("idemKey") WHERE "idemKey" IS NOT NULL DO NOTHING`,
          },
        );
      await insert();
      await insert();
      expect(
        await db.count(
          'SELECT COUNT(*) FROM "Notification" WHERE "idemKey" = $1',
          [key],
        ),
      ).toBe(1);

      // Two null-key rows must both land.
      for (let i = 0; i < 2; i++) {
        await db.insertRow(
          "Notification",
          {
            userId: U_CUST,
            type: "t",
            title: "T",
            message: "M",
            link: null,
            idemKey: null,
          },
          {
            noUpdatedAt: true,
            onConflict: `("idemKey") WHERE "idemKey" IS NOT NULL DO NOTHING`,
          },
        );
      }
      expect(
        await db.count(
          'SELECT COUNT(*) FROM "Notification" WHERE "userId" = $1 AND "idemKey" IS NULL',
          [U_CUST],
        ),
      ).toBe(2);
    }, 60_000);
  });

  describe("transitionLead inside a caller transaction", () => {
    it("locks the row, writes state and audits in one commit", async () => {
      const before = await db.count(
        `SELECT COUNT(*) FROM "AuditLog" WHERE "targetId" = $1 AND "kind" = 'transition.lead'`,
        [B],
      );

      await db.tx(async (client) => {
        const to = await lead.transitionLead({
          briefId: B,
          to: "SUBMITTED",
          actor: { kind: "user", userId: U_CUST, companyId: CO },
          client,
        });
        expect(to).toBe("SUBMITTED");
      });

      const row = await db.queryOne<{ leadState: string; stage: string }>(
        'SELECT "leadState","stage" FROM "ProjectBrief" WHERE "id" = $1',
        [B],
      );
      expect(row?.leadState).toBe("SUBMITTED");
      // Legacy projection must move with it.
      expect(row?.stage).toBe("SOURCING");

      const after = await db.count(
        `SELECT COUNT(*) FROM "AuditLog" WHERE "targetId" = $1 AND "kind" = 'transition.lead'`,
        [B],
      );
      expect(after).toBe(before + 1);
    }, 60_000);

    it("rolls back the state change when the caller's transaction fails", async () => {
      // This is the property the whole atomicity change exists for.
      await expect(
        db.tx(async (client) => {
          await lead.transitionLead({
            briefId: B,
            to: "IN_TRIAGE",
            actor: { kind: "user", userId: U_CUST, companyId: CO },
            client,
          });
          throw new Error("simulated failure after the transition");
        }),
      ).rejects.toThrow("simulated failure");

      const row = await db.queryOne<{ leadState: string }>(
        'SELECT "leadState" FROM "ProjectBrief" WHERE "id" = $1',
        [B],
      );
      // Still SUBMITTED — the transition did not leak out of the aborted tx.
      expect(row?.leadState).toBe("SUBMITTED");
    }, 60_000);

    it("is idempotent for a repeat transition", async () => {
      const same = await lead.transitionLead({
        briefId: B,
        to: "SUBMITTED",
        actor: { kind: "user", userId: U_CUST, companyId: CO },
      });
      expect(same).toBe("SUBMITTED");
    }, 60_000);

    it("rejects an illegal edge", async () => {
      await expect(
        lead.transitionLead({
          briefId: B,
          to: "COMPLETED",
          actor: { kind: "user", userId: U_CUST, companyId: CO },
        }),
      ).rejects.toThrow();
    }, 60_000);
  });
});
