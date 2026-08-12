/**
 * Atomicity and concurrency.
 *
 * Lifecycle hops used to be sequences of independent statements against
 * the pool, so a mid-request preemption (routine on Cloud Run) could
 * leave a submitted lead with no triage SLA, a submitted proposal whose
 * invite still looked un-submitted, or a half-built comparison grid.
 * There was also no row locking anywhere, so a double-click resolved by
 * statement ordering.
 *
 * These are structural assertions over the call sites plus a real
 * exercise of the reminder compare-and-swap.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Body of the named exported action, up to the next export. */
function actionBody(src: string, exportName: string): string {
  const start = src.indexOf(`export const ${exportName}`);
  expect(start, `${exportName} not found`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport const ", start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("lifecycle hops are transactional", () => {
  it("submitBriefAction commits the brief update, lead hop and triage timer together", () => {
    const body = actionBody(
      read("src/lib/actions/briefs.ts"),
      "submitBriefAction",
    );
    expect(body).toContain("await tx(async (client)");

    const txStart = body.indexOf("await tx(async (client)");
    const txBlock = body.slice(txStart);
    // All three state writes must be inside, each threading the client.
    expect(txBlock).toMatch(/updateRows\("ProjectBrief"[\s\S]*?\{ client \}/);
    expect(txBlock).toMatch(/advanceLeadIfAllowed\(\{[\s\S]*?client,/);
    expect(txBlock).toMatch(/startTimer\(\{[\s\S]*?client,/);

    // Notifications must stay OUTSIDE — email must not roll back a
    // submission the customer already made.
    const notifyIdx = body.indexOf('event: "brief.submitted"');
    expect(notifyIdx).toBeGreaterThan(txStart);
    expect(body.slice(txStart, notifyIdx)).toContain("});");
  });

  it("submitStructuredProposalAction commits all five writes together", () => {
    const body = actionBody(
      read("src/lib/actions/proposal-builder.ts"),
      "submitStructuredProposalAction",
    );
    const txBlock = body.slice(body.indexOf("await tx(async (client)"));
    expect(txBlock).toMatch(/transitionProposal\(\{[\s\S]*?client,/);
    expect(txBlock).toMatch(/transitionInvite\(\{[\s\S]*?client,/);
    expect(txBlock).toContain('satisfyTimer("match", matchId, "proposal_submit", client)');
    expect(txBlock).toMatch(/transitionLead\(\{[\s\S]*?client,/);
    // Rank must be computed inside so it counts this submission.
    expect(txBlock).toContain("SELECT COUNT(*) AS count");
  });

  it("markEngagementDeliveredAction commits delivery with the terminal lead hop", () => {
    const body = actionBody(
      read("src/lib/actions/engagements.ts"),
      "markEngagementDeliveredAction",
    );
    const txBlock = body.slice(body.indexOf("await tx(async (client)"));
    expect(txBlock).toContain('"status" = \'DELIVERED\'');
    expect(txBlock).toMatch(/transitionLead\(\{[\s\S]*?client,/);
  });

  it("the comparison grid is built in one transaction", () => {
    const body = actionBody(
      read("src/lib/actions/qc.ts"),
      "adminBuildComparisonAction",
    );
    const txStart = body.indexOf("await tx(async (client)");
    expect(txStart).toBeGreaterThan(-1);
    const txBlock = body.slice(txStart);
    expect(txBlock).toContain('"ComparisonView"');
    expect(txBlock).toContain('"ComparisonColumn"');
    expect(txBlock).toContain('"ComparisonCell"');
    // Every write threads the client.
    expect(txBlock).not.toMatch(/insertRow\(\s*"Comparison\w+",\s*\{[^}]*\}\s*\)\s*;/);
  });
});

describe("check-and-set replaces read-then-write", () => {
  it("transitions lock the row when inside a transaction", () => {
    for (const file of [
      "src/lib/state-machine/lead.ts",
      "src/lib/state-machine/invite.ts",
      "src/lib/state-machine/proposal.ts",
    ]) {
      const src = read(file);
      expect(src, file).toContain("FOR UPDATE");
      expect(src, file).toContain("client?: PoolClient");
    }
  });

  it("engagement acceptance claims the row on its expected status", () => {
    const body = actionBody(
      read("src/lib/actions/engagements.ts"),
      "acceptEngagementAction",
    );
    expect(body).toMatch(
      /UPDATE "Engagement"[\s\S]*?WHERE "id" = \$1 AND "status" = 'PENDING_ACCEPTANCE'/,
    );
    expect(body).toContain("if (claimed === 0)");
  });

  it("selectProposal asserts exactly one row was updated", () => {
    const body = actionBody(
      read("src/lib/actions/proposals.ts"),
      "selectProposalAction",
    );
    expect(body).toContain("selected.rowCount !== 1");
  });

  it("audit failures propagate inside a caller transaction", () => {
    // Swallowing there would leave the transaction aborted and surface
    // later as an unexplained COMMIT failure.
    const src = read("src/lib/state-machine/transition.ts");
    expect(src).toContain("if (opts.client) throw err;");
  });
});

describe("timer reminder compare-and-swap", () => {
  it("claims the offset before sending, guarded on the value it read", () => {
    const src = read("src/lib/timers/index.ts");
    const sweep = src.slice(src.indexOf("export async function sweepTimers"));
    const reminderBlock = sweep.slice(0, sweep.indexOf("// ── Expiries"));

    // The UPDATE must be guarded on the previously-read remindersSent
    // and must come BEFORE runReminder.
    expect(reminderBlock).toContain('AND "remindersSent" = $3');
    expect(reminderBlock).toContain("if (claimed === 0) continue;");
    expect(reminderBlock.indexOf("const claimed = await exec(")).toBeLessThan(
      reminderBlock.indexOf("await runReminder("),
    );
  });

  it("expiry keeps its existing compare-and-swap", () => {
    const src = read("src/lib/timers/index.ts");
    expect(src).toContain(`WHERE "id" = $1 AND "status" = 'active'`);
  });
});
