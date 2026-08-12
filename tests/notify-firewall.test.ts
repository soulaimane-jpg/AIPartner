/**
 * Identity firewall in the notification channel.
 *
 * The page-render path is well guarded by the serializers in
 * `@/lib/serializers/firewall`. Notifications are a second, parallel
 * channel to the same customer and had no firewall at all: `notify()`
 * rendered whatever variables the caller passed.
 *
 * `tests/notification-coverage.test.ts` asserts source-level properties
 * (no raw inserts, every event has copy, actionable events carry a link)
 * — all of which pass happily on a notification that names a partner to
 * a customer pre-reveal. These tests actually call `notify()` and
 * inspect what would be written and emailed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const inserted: { table: string; data: Row }[] = [];
const enqueued: { name: string; payload: Row }[] = [];
const captured: { message: string; context: Row }[] = [];

/** Recipients the fake User table knows about. */
const USERS = [
  { id: "u-customer", email: "buyer@acme.com", role: "CUSTOMER" },
  { id: "u-collab", email: "legal@acme.com", role: "COLLABORATOR" },
  { id: "u-admin", email: "ops@aipartner.cloud", role: "ADMIN" },
  { id: "u-partner", email: "sales@integrator.com", role: "PARTNER" },
];

vi.mock("@/lib/db", () => ({
  query: (text: string, params: unknown[] = []) => {
    if (text.includes('FROM "User"')) {
      const [ids, emails] = params as [string[], string[]];
      return Promise.resolve(
        USERS.filter(
          (u) =>
            (ids ?? []).includes(u.id) ||
            (emails ?? []).includes(u.email.toLowerCase()),
        ),
      );
    }
    return Promise.resolve([]);
  },
  // No NotificationTemplate override in tests.
  queryOne: () => Promise.resolve(null),
  insertRow: (table: string, data: Row) => {
    inserted.push({ table, data });
    return Promise.resolve({ id: "n1", ...data });
  },
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueue: (name: string, payload: Row) => {
    enqueued.push({ name, payload });
    return Promise.resolve({ id: "j1" });
  },
}));

vi.mock("@/lib/observability", () => ({
  captureError: (err: unknown, context: Row) => {
    captured.push({
      message: err instanceof Error ? err.message : String(err),
      context,
    });
  },
  captureWarning: () => undefined,
}));

const { notify } = await import("@/lib/notify");

const PARTNER = "Northwind Cloud Consulting";

beforeEach(() => {
  inserted.length = 0;
  enqueued.length = 0;
  captured.length = 0;
});

function allText() {
  return [
    ...inserted.map((i) => `${i.data.title} ${i.data.message}`),
    ...enqueued.map((e) => `${e.payload.subject} ${e.payload.body}`),
  ].join("\n");
}

describe("notify() identity firewall", () => {
  it("redacts a partner name sent to a CUSTOMER pre-reveal", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "Billing migration", partnerName: PARTNER, reason: "capacity" },
      link: "/briefs/b1/preview",
    });

    expect(inserted).toHaveLength(1);
    expect(enqueued).toHaveLength(1);
    expect(allText()).not.toContain(PARTNER);
    expect(allText()).toContain("your matched partner");
  });

  it("redacts for a COLLABORATOR too — they see the customer's view", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-collab" }],
      vars: { briefTitle: "Billing migration", partnerName: PARTNER },
    });
    expect(allText()).not.toContain(PARTNER);
  });

  it("reports the redaction so it cannot happen silently", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "B", partnerName: PARTNER },
    });
    expect(captured).toHaveLength(1);
    expect(captured[0].message).toContain("partnerName");
    expect(captured[0].message).toContain("CUSTOMER");
  });

  it("does NOT redact for admins — they run the reveal process", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-admin" }],
      vars: { briefTitle: "B", partnerName: PARTNER, reason: "capacity" },
    });
    expect(allText()).toContain(PARTNER);
    expect(captured).toHaveLength(0);
  });

  it("does NOT redact for the partner's own users", async () => {
    await notify({
      event: "partner.verification_approved",
      recipients: [{ userId: "u-partner" }],
      vars: { partnerName: PARTNER },
    });
    expect(allText()).toContain(PARTNER);
  });

  it("allows the name to a customer once revealed:true is passed", async () => {
    await notify({
      event: "brief.partner_selected",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "B", partnerName: PARTNER },
      revealed: true,
    });
    expect(captured).toHaveLength(0);
  });

  it("redacts per recipient in a mixed fan-out", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-admin" }, { userId: "u-customer" }],
      vars: { briefTitle: "B", partnerName: PARTNER },
    });
    const adminRow = inserted.find((i) => i.data.userId === "u-admin")!;
    const customerRow = inserted.find((i) => i.data.userId === "u-customer")!;
    expect(String(adminRow.data.message)).toContain(PARTNER);
    expect(String(customerRow.data.message)).not.toContain(PARTNER);
  });

  it("covers every identity-bearing variable, not just partnerName", async () => {
    await notify({
      event: "partner.accepted_admin",
      recipients: [{ userId: "u-customer" }],
      vars: {
        briefTitle: "B",
        partnerName: PARTNER,
        acceptedName: "Jane Partner",
      },
    });
    expect(allText()).not.toContain(PARTNER);
    expect(allText()).not.toContain("Jane Partner");
  });

  it("leaves non-identity variables intact", async () => {
    await notify({
      event: "partner.declined_admin",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "Billing migration", partnerName: PARTNER, reason: "no capacity" },
    });
    expect(allText()).toContain("Billing migration");
    expect(allText()).toContain("no capacity");
  });
});

describe("notify() idempotency", () => {
  it("stamps an idemKey on in-app rows so retries cannot duplicate", async () => {
    await notify({
      event: "brief.triaged",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "B" },
      idemKey: "triaged:b1",
    });
    expect(inserted[0].data.idemKey).toBe("brief.triaged:triaged:b1:u-customer");
  });

  it("leaves idemKey null when the caller supplies none", async () => {
    await notify({
      event: "brief.triaged",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "B" },
    });
    expect(inserted[0].data.idemKey).toBeNull();
  });
});

describe("notify() failure reporting", () => {
  it("reports instead of swallowing when the insert fails", async () => {
    const db = await import("@/lib/db");
    vi.spyOn(db, "insertRow").mockRejectedValueOnce(new Error("pg down"));
    await notify({
      event: "brief.triaged",
      recipients: [{ userId: "u-customer" }],
      vars: { briefTitle: "B" },
    });
    expect(
      captured.some((c) => c.message.includes("notification insert failed")),
    ).toBe(true);
  });

  it("never throws — a notification failure must not roll back the action", async () => {
    const db = await import("@/lib/db");
    vi.spyOn(db, "query").mockRejectedValueOnce(new Error("pg down"));
    await expect(
      notify({
        event: "brief.triaged",
        recipients: [{ userId: "u-customer" }],
        vars: { briefTitle: "B" },
      }),
    ).resolves.toBeUndefined();
  });
});
