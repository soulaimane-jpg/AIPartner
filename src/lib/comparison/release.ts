/**
 * Comparison release engine — plan-A M8c + M6.7 submission-order
 * staggering.
 *
 * Columns are released to the company **in submission order**; a
 * later partner's column unlocks no earlier than `stagger_hours`
 * after the previous one, and only once its proposal is QC-passed
 * and its anonymization is human-approved.
 *
 * `releaseComparison()` — the admin's final "Reviewed & Approved"
 * gate: marks the view released, opens column #1, schedules the
 * stagger timer for the rest.
 *
 * `releaseNextComparisonColumn()` — invoked by the stagger timer;
 * releases the next eligible column and re-arms the timer while
 * unreleased columns remain.
 */

import "server-only";
import { query, queryOne, count, insertRow, tx } from "@/lib/db";
import type { ComparisonColumnRow } from "@/lib/db/rows";
import { getSetting } from "@/lib/settings";
import { notifyCompanyUsers } from "@/lib/notify";

async function eligibleForRelease(matchId: string): Promise<boolean> {
  const row = await queryOne<{
    qcPassedAt: Date | null;
    status: string;
    anonStatus: string | null;
  }>(
    `SELECT p."qcPassedAt", p."status", a."status" AS "anonStatus"
     FROM "Proposal" p
     LEFT JOIN "AnonymizedProposal" a ON a."proposalId" = p."id"
     WHERE p."matchId" = $1`,
    [matchId],
  );
  if (!row) return false;
  const qcPassed = row.qcPassedAt != null || row.status === "QC_PASSED";
  return qcPassed && row.anonStatus === "approved";
}

async function releaseColumn(opts: {
  viewId: string;
  columnId: string;
  matchId: string;
  briefId: string;
}): Promise<void> {
  const now = new Date();
  await tx(async (client) => {
    await client.query(
      'UPDATE "ComparisonColumn" SET "releasedAt" = $2, "updatedAt" = NOW() WHERE "id" = $1',
      [opts.columnId, now],
    );
    await client.query(
      'UPDATE "Proposal" SET "releasedAt" = $2, "updatedAt" = NOW() WHERE "matchId" = $1',
      [opts.matchId, now],
    );
  });
  await insertRow(
    "AuditLog",
    {
      actorId: null,
      kind: "comparison.column_released",
      targetId: opts.columnId,
      targetType: "ComparisonColumn",
      payload: JSON.stringify({ briefId: opts.briefId, matchId: opts.matchId }),
    },
    { noUpdatedAt: true },
  ).catch(() => undefined);
}

async function armStaggerTimer(briefId: string): Promise<void> {
  // Local import avoids a circular dependency (timers → handlers → here).
  const { startTimer } = await import("@/lib/timers");
  const staggerHours = await getSetting("stagger_hours");
  await startTimer({
    entityType: "brief",
    entityId: briefId,
    timerType: "stagger_release",
    deadlineAt: new Date(Date.now() + staggerHours * 3_600_000),
    meta: { briefId },
  });
}

/**
 * Admin final release (M8c). Releases the first eligible column
 * immediately; the rest follow on the stagger cadence. Returns the
 * number of columns still pending.
 */
export async function releaseComparison(
  briefId: string,
  releasedBy: string,
): Promise<{ releasedNow: number; pending: number }> {
  const view = await queryOne<{ id: string; status: string }>(
    'SELECT "id", "status" FROM "ComparisonView" WHERE "briefId" = $1',
    [briefId],
  );
  if (!view) throw new Error("Comparison view not found");
  const columns = await query<ComparisonColumnRow>(
    'SELECT * FROM "ComparisonColumn" WHERE "viewId" = $1 ORDER BY "submissionRank" ASC',
    [view.id],
  );

  if (view.status !== "released") {
    await query(
      `UPDATE "ComparisonView" SET "status" = 'released', "releasedAt" = NOW(), "releasedBy" = $2, "updatedAt" = NOW()
       WHERE "id" = $1`,
      [view.id, releasedBy],
    );
  }

  // Release the first eligible unreleased column right away.
  let releasedNow = 0;
  for (const column of columns) {
    if (column.releasedAt) continue;
    if (await eligibleForRelease(column.matchId)) {
      await releaseColumn({
        viewId: view.id,
        columnId: column.id,
        matchId: column.matchId,
        briefId,
      });
      releasedNow++;
      break; // stagger applies from the second column onward
    }
  }

  const pending = await count(
    'SELECT COUNT(*) AS count FROM "ComparisonColumn" WHERE "viewId" = $1 AND "releasedAt" IS NULL',
    [view.id],
  );
  if (pending > 0) await armStaggerTimer(briefId);

  return { releasedNow, pending };
}

/**
 * Stagger-timer target: release the next eligible column in
 * submission order and notify the company; re-arm while columns
 * remain. Skips (and re-arms) when the next column isn't QC/anon
 * approved yet — "its column joins later, stagger rules still apply"
 * (plan-A M8 edge case).
 */
export async function releaseNextComparisonColumn(
  briefId: string,
): Promise<void> {
  const view = await queryOne<{
    id: string;
    status: string;
    briefTitle: string;
    companyId: string;
  }>(
    `SELECT v."id", v."status", b."title" AS "briefTitle", b."companyId"
     FROM "ComparisonView" v
     JOIN "ProjectBrief" b ON b."id" = v."briefId"
     WHERE v."briefId" = $1`,
    [briefId],
  );
  if (!view || view.status !== "released") return;

  const unreleased = await query<ComparisonColumnRow>(
    `SELECT * FROM "ComparisonColumn"
     WHERE "viewId" = $1 AND "releasedAt" IS NULL
     ORDER BY "submissionRank" ASC`,
    [view.id],
  );
  if (unreleased.length === 0) return;

  let released = false;
  for (const column of unreleased) {
    if (await eligibleForRelease(column.matchId)) {
      await releaseColumn({
        viewId: view.id,
        columnId: column.id,
        matchId: column.matchId,
        briefId,
      });
      await notifyCompanyUsers(view.companyId, {
        event: "comparison.column_released",
        vars: { briefTitle: view.briefTitle },
        link: `/briefs/${briefId}/compare`,
        briefId,
        idemKey: `column:${column.id}`,
      });
      released = true;
      break; // one column per stagger tick
    }
  }

  const remaining = unreleased.length - (released ? 1 : 0);
  if (remaining > 0) {
    await armStaggerTimer(briefId); // re-arm for the next tick
  }
}
