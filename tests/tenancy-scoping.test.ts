/**
 * Cross-tenant write regression tests.
 *
 * These execute the real helpers against a mocked database and assert
 * that a foreign child id is rejected, rather than asserting something
 * about the source text. Two shipped actions had this bug:
 *
 *   - `captureWinLossAction` resolved proposals with `WHERE "id" = $1`
 *   - `selectProposalAction` wrote `SELECTED` with `WHERE "id" = $1`
 *
 * Both verified brief ownership first, so RBAC passed and the write
 * landed on another tenant's row. The grep-style tests in this suite
 * could never have caught it — hence real execution here.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionFailure } from "@/lib/schemas/errors";

/** Captured SQL so we can assert on the predicates actually issued. */
const issued: { text: string; params: unknown[] }[] = [];
/** Rows the fake database will return, keyed by a substring match. */
let queryImpl: (text: string, params: unknown[]) => unknown[];

vi.mock("@/lib/db", () => ({
  query: (text: string, params: unknown[] = []) => {
    issued.push({ text, params });
    return Promise.resolve(queryImpl(text, params));
  },
  queryOne: (text: string, params: unknown[] = []) => {
    issued.push({ text, params });
    return Promise.resolve(queryImpl(text, params)[0] ?? null);
  },
}));

const { requireProposalInBrief, requireProposalsInBrief, requireMatchInBrief } =
  await import("@/lib/actions/tenancy");

/**
 * Stand-in for Postgres: only returns a row when the statement carries
 * BOTH the id and the briefId, which is precisely the property under
 * test. A helper that forgets `"briefId"` gets nothing back.
 */
function scopedStore(rows: { id: string; briefId: string; matchId: string }[]) {
  return (text: string, params: unknown[]) => {
    const scoped = text.includes('"briefId"');
    if (!scoped) {
      // Emulate the vulnerable query: id-only lookup finds the row
      // regardless of tenant. If a helper does this, the test below
      // sees a successful resolve and fails.
      const [id] = params as string[];
      return rows.filter((r) => r.id === id || (Array.isArray(id) && id.includes(r.id)));
    }
    const [idOrIds, briefId] = params as [string | string[], string];
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    return rows.filter((r) => ids.includes(r.id) && r.briefId === briefId);
  };
}

const ROWS = [
  { id: "prop-mine", briefId: "brief-mine", matchId: "match-mine" },
  { id: "prop-theirs", briefId: "brief-theirs", matchId: "match-theirs" },
];

beforeEach(() => {
  issued.length = 0;
  queryImpl = scopedStore(ROWS);
});

async function expectNotFound(fn: () => Promise<unknown>) {
  await expect(fn()).rejects.toBeInstanceOf(ActionFailure);
  await fn().catch((err) => {
    expect((err as ActionFailure).error.code).toBe("NOT_FOUND");
  });
}

describe("requireProposalInBrief", () => {
  it("resolves a proposal that belongs to the brief", async () => {
    const row = await requireProposalInBrief("prop-mine", "brief-mine");
    expect(row.matchId).toBe("match-mine");
  });

  it("rejects a proposal from another brief", async () => {
    await expectNotFound(() =>
      requireProposalInBrief("prop-theirs", "brief-mine"),
    );
  });

  it("scopes the SQL by briefId, not by id alone", async () => {
    await requireProposalInBrief("prop-mine", "brief-mine");
    expect(issued).toHaveLength(1);
    expect(issued[0].text).toContain('"briefId"');
    expect(issued[0].params).toEqual(["prop-mine", "brief-mine"]);
  });

  it("does not leak existence — foreign id yields NOT_FOUND, not FORBIDDEN", async () => {
    let captured: ActionFailure | null = null;
    try {
      await requireProposalInBrief("prop-theirs", "brief-mine");
    } catch (err) {
      captured = err as ActionFailure;
    }
    expect(captured).toBeInstanceOf(ActionFailure);
    expect(captured!.error.code).toBe("NOT_FOUND");
  });
});

describe("requireProposalsInBrief", () => {
  it("resolves when every id belongs to the brief", async () => {
    const found = await requireProposalsInBrief(["prop-mine"], "brief-mine");
    expect(found.get("prop-mine")?.matchId).toBe("match-mine");
  });

  it("is all-or-nothing: one foreign id rejects the whole batch", async () => {
    // The vulnerable original used `continue`, silently skipping
    // unresolvable ids so the caller never learned anything was wrong.
    await expectNotFound(() =>
      requireProposalsInBrief(["prop-mine", "prop-theirs"], "brief-mine"),
    );
  });

  it("returns an empty map for an empty batch without querying", async () => {
    const found = await requireProposalsInBrief([], "brief-mine");
    expect(found.size).toBe(0);
    expect(issued).toHaveLength(0);
  });
});

describe("requireMatchInBrief", () => {
  it("rejects a match from another brief", async () => {
    queryImpl = scopedStore([
      { id: "match-theirs", briefId: "brief-theirs", matchId: "match-theirs" },
    ]);
    await expectNotFound(() =>
      requireMatchInBrief("match-theirs", "brief-mine"),
    );
  });
});

// ─── Class-level guard ────────────────────────────────────────────

/**
 * Ratchet against the pattern returning.
 *
 * Three shipped actions had it — `captureWinLossAction`,
 * `selectProposalAction` and `narrowShortlistAction` — all now scoped.
 *
 * Whether a bare-id lookup is safe depends on where the id came from,
 * which a regex cannot determine. So instead of pretending to do
 * dataflow analysis, this pins the set of files allowed to contain the
 * shape, each with the reason it's safe. A NEW file matching the shape
 * fails the test and has to be reviewed and justified here.
 */
describe("Proposal/Match bare-id lookups stay reviewed", () => {
  const actionsDir = resolve(process.cwd(), "src/lib/actions");

  /** file → why a bare-id lookup is safe there. */
  const REVIEWED: Record<string, string> = {
    "src/lib/actions/admin.ts":
      "adminRemoveMatchAction is ADMIN-only (admin.partner-ops); admins legitimately act across tenants. narrowShortlist now re-scopes via requireMatchesInBrief.",
    "src/lib/actions/briefs.ts":
      "declineMatchAction/approveMatchAction are gated by the isInvitedPartner RBAC condition, which resolves matchId and compares partnerId to the caller's companyId.",
    "src/lib/actions/match-notes.ts":
      "assertMatchAccess compares match.partnerId to the caller's companyId before any write.",
    "src/lib/actions/partner-meeting.ts":
      "Handler compares match.partnerId to ctx.user.companyId and fails FORBIDDEN otherwise.",
    "src/lib/actions/proposal-builder.ts":
      "ensureProposal compares match.partnerId to the partner's companyId before creating/updating.",
    "src/lib/actions/qc.ts":
      "QC is ADMIN-only (admin.partner-ops); crossing briefs is the job.",
    "src/lib/actions/win-loss.ts":
      "Match ids are derived from requireProposalInBrief/requireProposalsInBrief, so they are already scoped to the authorized brief.",
  };

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (entry.endsWith(".ts")) out.push(full);
    }
    return out;
  }

  it("only appears in files that have been reviewed and justified", () => {
    const bareId =
      /(?:FROM|UPDATE)\s+"(?:Proposal|Match)"[\s\S]{0,200}?WHERE\s+"id"\s*=\s*\$\d(?![\s\S]{0,120}?"(?:briefId|partnerId|companyId)")/g;

    const unreviewed: string[] = [];
    for (const file of walk(actionsDir)) {
      const rel = file.replace(`${process.cwd()}/`, "");
      if (rel.endsWith("tenancy.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (bareId.test(text) && !REVIEWED[rel]) unreviewed.push(rel);
      bareId.lastIndex = 0;
    }

    expect(
      unreviewed,
      `These files resolve Proposal/Match by bare id. Either scope the query to the authorized parent (see @/lib/actions/tenancy) or add the file to REVIEWED with a justification:\n${unreviewed.join(
        "\n",
      )}`,
    ).toEqual([]);
  });

  it("keeps the three fixed actions scoped", () => {
    const winLoss = readFileSync(
      resolve(process.cwd(), "src/lib/actions/win-loss.ts"),
      "utf8",
    );
    const proposals = readFileSync(
      resolve(process.cwd(), "src/lib/actions/proposals.ts"),
      "utf8",
    );
    const admin = readFileSync(
      resolve(process.cwd(), "src/lib/actions/admin.ts"),
      "utf8",
    );

    // No bare-id Proposal lookups left in the two that had them.
    expect(winLoss).not.toMatch(/FROM "Proposal" WHERE "id" = \$1/);
    expect(winLoss).toContain("requireProposalInBrief");
    expect(winLoss).toContain("requireProposalsInBrief");

    expect(proposals).toContain("requireProposalInBrief");
    expect(proposals).toContain('WHERE "id" = $1 AND "briefId" = $2');

    expect(admin).toContain("requireMatchesInBrief");
    expect(admin).toContain('WHERE "id" = $1 AND "briefId" = $3');
  });
});
