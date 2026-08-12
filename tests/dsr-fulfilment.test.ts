/**
 * GDPR data-subject-request fulfilment.
 *
 * `actions/dsr.ts` recorded export/erase/rectify requests and let users
 * cancel them, but nothing ever completed one — no route, no job handler,
 * no worker. The 30-day statutory clock started with nothing on the other
 * end. `jobs/retention.ts` is an unrelated TTL purge and never touched
 * `DsrRequest`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const worker = read("src/lib/jobs/dsr.ts");
const action = read("src/lib/actions/dsr.ts");
const queue = read("src/lib/jobs/queue.ts");
const retentionCron = read("src/app/api/cron/retention/route.ts");
const adminPage = read("src/app/admin/(portal)/dsr/page.tsx");

describe("fulfilment is wired end to end", () => {
  it("registers handlers for export and erase", () => {
    expect(queue).toContain('"dsr.export"');
    expect(queue).toContain('"dsr.erase"');
    expect(queue).toContain('"dsr.sweep"');
  });

  it("enqueues fulfilment when the request is submitted", () => {
    expect(action).toContain("enqueue(");
    expect(action).toContain('kind === "export" ? "dsr.export" : "dsr.erase"');
    // Idempotent so a retry cannot double-erase.
    expect(action).toContain("idemKey: `dsr:${row.id}`");
  });

  it("leaves rectify to a human but still enqueues the other two", () => {
    expect(action).toMatch(/if \(kind === "export" \|\| kind === "erase"\)/);
  });

  it("has a catch-up sweep on the nightly cron", () => {
    expect(retentionCron).toContain("sweepDsrRequests");
  });

  it("claims a request before working it, so two runners cannot both fulfil", () => {
    expect(worker).toContain(`WHERE "id" = $1 AND "status" = 'queued'`);
    expect(worker).toContain("async function claim(");
  });
});

describe("erasure anonymises and retains the compliance record", () => {
  it("tombstones the login and clears every identifying column", () => {
    for (const col of [
      '"email" = $2',
      '"name" = NULL',
      '"firstName" = NULL',
      '"lastName" = NULL',
      '"passwordHash" = NULL',
      '"image" = NULL',
      '"jobTitle" = NULL',
      '"location" = NULL',
      '"googleId" = NULL',
    ]) {
      expect(worker, `${col} not scrubbed`).toContain(col);
    }
    expect(worker).toContain("@deleted.invalid");
  });

  it("revokes every credential and session", () => {
    for (const table of [
      "AuthSession",
      "PasswordResetToken",
      "EmailVerificationToken",
      "AuthMfaCredential",
      "AuthPasskey",
    ]) {
      expect(worker, `${table} not cleared`).toContain(`FROM "${table}"`);
    }
  });

  it("scrubs authored free text without deleting the thread", () => {
    expect(worker).toContain('UPDATE "Comment" SET "body"');
    expect(worker).toContain('UPDATE "ClarificationMessage"');
    expect(worker).toContain("erased at the author");
  });

  it("does not set updatedAt on ClarificationMessage — it has no such column", () => {
    // Setting it aborted the transaction and rolled the entire erasure
    // back. Caught only by the real-database integration test; this pins
    // the fix so a future edit can't reintroduce it.
    const stmt = worker.slice(
      worker.indexOf('UPDATE "ClarificationMessage"'),
      worker.indexOf('WHERE "authorId" = $1', worker.indexOf('UPDATE "ClarificationMessage"')),
    );
    expect(stmt).not.toContain("updatedAt");
  });

  it("selects columns that exist on CookieConsent and LegalAcceptance", () => {
    // Two more runtime-only bugs the integration test surfaced.
    expect(worker).toContain('"categories", "action", "policyVersion"');
    expect(worker).not.toContain('"analytics", "marketing"');
    expect(worker).toContain('"documentId", "acceptedName"');
    expect(worker).not.toMatch(/LegalAcceptance[\s\S]{0,80}acceptedAt/);
  });

  it("does NOT delete the audit trail", () => {
    // art. 5(2) accountability: deleting the trail destroys the evidence
    // that we processed this person's data lawfully. The actorId already
    // points at a scrubbed row, so it is pseudonymous.
    expect(worker).not.toMatch(/DELETE FROM "AuditLog"/);
    expect(worker).toContain("art. 5(2)");
  });

  it("does NOT delete legal acceptances or financial records", () => {
    for (const table of ["LegalAcceptance", "Engagement", "DealReport"]) {
      expect(worker).not.toMatch(
        new RegExp(`DELETE FROM "${table}"`),
      );
    }
    expect(worker).toContain("art. 17(3)");
  });

  it("runs the mutation in one transaction", () => {
    expect(worker).toContain("await tx(async (client)");
  });

  it("emails the original address before it is destroyed", () => {
    expect(worker).toContain("const originalEmail = user.email");
    // And a bounced confirmation must not undo a completed erasure.
    expect(worker).toContain("stage: \"confirmation-email\"");
  });

  it("is idempotent for an already-completed request", () => {
    expect(worker).toContain('request.status === "complete"');
  });
});

describe("export bundle", () => {
  it("is an explicit field list, not a schema walk", () => {
    // An automatic dump would leak another tenant's data the moment
    // someone adds a join table.
    expect(worker).toContain("Deliberately explicit rather than a schema walk");
    expect(worker).toContain('FROM "ProjectBrief" WHERE "ownerId" = $1');
  });

  it("never includes session tokens", () => {
    expect(worker).toContain("Session metadata only — never tokens");
    expect(worker).not.toMatch(/SELECT[^;]*"sessionToken"/);
  });

  it("marks the request complete and audits it", () => {
    expect(worker).toContain('kind: "dsr.export.completed"');
    expect(worker).toContain('status: "complete"');
  });
});

describe("admin visibility", () => {
  it("surfaces the 30-day statutory deadline", () => {
    expect(adminPage).toContain("SLA_DAYS = 30");
    expect(adminPage).toContain("Overdue");
    expect(adminPage).toContain("reportable compliance breach");
  });

  it("is admin-gated", () => {
    expect(adminPage).toContain("requireAdmin()");
  });

  it("is reachable from the admin navigation", () => {
    expect(read("src/components/portal/portal-nav-config.ts")).toContain(
      '"/admin/dsr"',
    );
  });
});
