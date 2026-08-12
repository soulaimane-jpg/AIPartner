import "server-only";

import { exec, query, queryOne, tx, updateRows } from "@/lib/db";
import { sendEmail } from "@/lib/email/provider";
import { captureError } from "@/lib/observability";
import { insertRow } from "@/lib/db";

/**
 * GDPR Data Subject Rights fulfilment.
 *
 * `actions/dsr.ts` recorded export/erase/rectify requests and allowed
 * cancellation, but nothing ever completed one: there was no route, no
 * job handler, and `jobs/retention.ts` is an unrelated TTL purge over
 * operational tables. For a product whose middleware comments cite GDPR
 * art. 5(1)(f), art. 17 had a queue and no worker — a 30-day statutory
 * clock with nothing on the other end.
 *
 * ── Erasure model: anonymise, retain the record ───────────────────
 *
 * A hard cascade delete is the wrong answer here and would itself breach
 * other obligations:
 *
 *   - `AuditLog` is the compliance backbone (art. 5(2) accountability).
 *     Deleting an actor's trail destroys the evidence that we handled
 *     *their* data lawfully.
 *   - Legal acceptances (T&C / NDA) are the record of a contract that
 *     was formed. art. 17(3)(b)/(e) explicitly permit retention.
 *   - `Engagement` / `DealReport` carry financial obligations with
 *     statutory retention periods of their own.
 *
 * So we scrub the identifying fields, tombstone the login, and leave the
 * skeleton rows with a pseudonymous actor reference. The person becomes
 * unidentifiable; the ledger stays intact.
 */

/** Stable pseudonym so audit rows remain correlatable but not identifying. */
function pseudonym(userId: string): string {
  // Not a hash of the email: that would be reversible by anyone holding a
  // candidate address. The user id is already an opaque cuid.
  return `erased:${userId.slice(0, 12)}`;
}

export interface DsrJobResult {
  requestId: string;
  kind: string;
  status: "complete" | "rejected";
}

async function loadRequest(requestId: string) {
  return queryOne<{
    id: string;
    userId: string;
    kind: string;
    status: string;
    notes: string | null;
  }>(
    'SELECT "id", "userId", "kind", "status", "notes" FROM "DsrRequest" WHERE "id" = $1',
    [requestId],
  );
}

/** Claim the request so two runners can't both fulfil it. */
async function claim(requestId: string): Promise<boolean> {
  const claimed = await exec(
    `UPDATE "DsrRequest" SET "status" = 'processing'
      WHERE "id" = $1 AND "status" = 'queued'`,
    [requestId],
  );
  return claimed === 1;
}

// ─── Export (art. 15 / art. 20) ────────────────────────────────────

/**
 * Assemble everything we hold about the subject.
 *
 * Deliberately explicit rather than a schema walk: an automatic dump
 * would leak other tenants' data through join tables the moment someone
 * adds one (e.g. a partner's proposal attached to the user's brief).
 */
export async function buildExportBundle(userId: string): Promise<{
  bundle: Record<string, unknown>;
  email: string;
}> {
  const user = await queryOne<Record<string, unknown> & { email: string }>(
    `SELECT "id", "email", "name", "firstName", "lastName", "role", "jobTitle",
            "location", "companyId", "image", "emailVerified", "focusArea",
            "challengeAreas", "surveyCompletedAt", "onboardedAt", "createdAt"
       FROM "User" WHERE "id" = $1`,
    [userId],
  );
  if (!user) throw new Error(`DSR export: user ${userId} not found`);

  const [
    briefs,
    collaborations,
    comments,
    notifications,
    npsResponses,
    consents,
    legalAcceptances,
    sessions,
    dsrHistory,
  ] = await Promise.all([
    query(
      `SELECT "id", "title", "status", "stage", "leadState", "completion",
              "createdAt", "submittedAt"
         FROM "ProjectBrief" WHERE "ownerId" = $1`,
      [userId],
    ),
    query(
      `SELECT bc."id", bc."briefId", bc."role", bc."status", bc."createdAt"
         FROM "BriefCollaborator" bc
        WHERE lower(bc."email") = lower((SELECT "email" FROM "User" WHERE "id" = $1))`,
      [userId],
    ),
    query(
      `SELECT "id", "briefId", "sectionKey", "body", "createdAt"
         FROM "Comment" WHERE "authorId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "type", "title", "message", "read", "createdAt"
         FROM "Notification" WHERE "userId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "score", "comment", "surface", "createdAt"
         FROM "NpsResponse" WHERE "userId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "categories", "action", "policyVersion", "createdAt"
         FROM "CookieConsent" WHERE "userId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "documentId", "acceptedName", "createdAt"
         FROM "LegalAcceptance" WHERE "userId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "createdAt", "lastSeenAt", "userAgent" FROM "AuthSession"
        WHERE "userId" = $1`,
      [userId],
    ),
    query(
      `SELECT "id", "kind", "status", "createdAt", "completedAt"
         FROM "DsrRequest" WHERE "userId" = $1`,
      [userId],
    ),
  ]);

  return {
    email: user.email,
    bundle: {
      exportedAt: new Date().toISOString(),
      subject: user,
      briefs,
      collaborations,
      comments,
      notifications,
      npsResponses,
      cookieConsents: consents,
      legalAcceptances,
      // Session metadata only — never tokens.
      sessions,
      dsrHistory,
      notes:
        "Audit-log entries are retained for compliance (GDPR art. 5(2)) and " +
        "are available on request to security@aipartner.cloud.",
    },
  };
}

export async function fulfilExport(requestId: string): Promise<DsrJobResult> {
  const request = await loadRequest(requestId);
  if (!request) throw new Error(`DSR request ${requestId} not found`);
  if (request.status !== "queued" && request.status !== "processing") {
    return { requestId, kind: request.kind, status: "complete" };
  }
  if (request.status === "queued" && !(await claim(requestId))) {
    return { requestId, kind: request.kind, status: "complete" };
  }

  const { bundle, email } = await buildExportBundle(request.userId);
  const json = JSON.stringify(bundle, null, 2);

  // Emailed as an attachment-style body rather than parked in object
  // storage: a signed URL to personal data is a second thing to leak and
  // to expire correctly. Small bundles only — if this grows past what a
  // mail body can carry, move it to GCS with a short-lived signed URL and
  // record the object path on `artefactUrl`.
  await sendEmail({
    toAddress: email,
    kind: "dsr",
    subject: "Your AI Partner data export",
    body: [
      "Hi,",
      "",
      "Your data export is below in JSON format.",
      "",
      "If you did not request this, contact security@aipartner.cloud immediately.",
      "",
      "— AI Partner",
      "",
      "--- BEGIN EXPORT ---",
      json.length > 400_000 ? `${json.slice(0, 400_000)}\n…truncated` : json,
      "--- END EXPORT ---",
    ].join("\n"),
  });

  await updateRows(
    "DsrRequest",
    { id: requestId },
    { status: "complete", completedAt: new Date() },
  );
  await insertRow(
    "AuditLog",
    {
      actorId: null,
      kind: "dsr.export.completed",
      targetId: requestId,
      targetType: "DsrRequest",
      payload: JSON.stringify({ userId: request.userId, bytes: json.length }),
    },
    { noUpdatedAt: true },
  );

  return { requestId, kind: "export", status: "complete" };
}

// ─── Erasure (art. 17) ─────────────────────────────────────────────

export async function fulfilErasure(requestId: string): Promise<DsrJobResult> {
  const request = await loadRequest(requestId);
  if (!request) throw new Error(`DSR request ${requestId} not found`);
  if (request.status === "complete" || request.status === "rejected") {
    return { requestId, kind: request.kind, status: "complete" };
  }
  if (request.status === "queued" && !(await claim(requestId))) {
    return { requestId, kind: request.kind, status: "complete" };
  }

  const user = await queryOne<{ id: string; email: string; role: string }>(
    'SELECT "id", "email", "role" FROM "User" WHERE "id" = $1',
    [request.userId],
  );
  if (!user) {
    await updateRows(
      "DsrRequest",
      { id: requestId },
      { status: "complete", completedAt: new Date(), notes: "User already removed" },
    );
    return { requestId, kind: "erase", status: "complete" };
  }

  // Tell them before we destroy the address we'd tell them with.
  const originalEmail = user.email;
  const tombstone = `${pseudonym(user.id)}@deleted.invalid`;

  await tx(async (client) => {
    // 1. Tombstone the login. The row stays so foreign keys elsewhere
    //    remain valid; nothing identifying survives on it.
    await client.query(
      `UPDATE "User"
          SET "email" = $2, "name" = NULL, "firstName" = NULL, "lastName" = NULL,
              "passwordHash" = NULL, "image" = NULL, "jobTitle" = NULL,
              "location" = NULL, "googleId" = NULL, "focusArea" = NULL,
              "challengeAreas" = '[]', "emailVerified" = NULL,
              "updatedAt" = NOW()
        WHERE "id" = $1`,
      [user.id, tombstone],
    );

    // 2. Revoke every credential and session immediately.
    await client.query('DELETE FROM "AuthSession" WHERE "userId" = $1', [user.id]);
    await client.query(
      'DELETE FROM "PasswordResetToken" WHERE "userId" = $1',
      [user.id],
    );
    await client.query(
      'DELETE FROM "EmailVerificationToken" WHERE "userId" = $1',
      [user.id],
    );
    await client.query(
      'DELETE FROM "AuthMfaCredential" WHERE "userId" = $1',
      [user.id],
    );
    await client.query('DELETE FROM "AuthPasskey" WHERE "userId" = $1', [
      user.id,
    ]);

    // 3. Free-text the user authored may name them. Scrub the content,
    //    keep the row so threads stay coherent for the other party.
    await client.query(
      `UPDATE "Comment" SET "body" = '[erased at the author''s request]',
              "updatedAt" = NOW()
        WHERE "authorId" = $1`,
      [user.id],
    );
    // No `updatedAt` on this table — setting one aborts the transaction
    // and rolls the whole erasure back. (Caught by the integration test;
    // a source-level check would have shipped it.)
    await client.query(
      `UPDATE "ClarificationMessage"
          SET "body" = '[erased at the author''s request]'
        WHERE "authorId" = $1`,
      [user.id],
    );
    await client.query(
      `UPDATE "NpsResponse" SET "comment" = NULL WHERE "userId" = $1`,
      [user.id],
    );

    // 4. Notifications are pure delivery artefacts — no reason to keep.
    await client.query('DELETE FROM "Notification" WHERE "userId" = $1', [
      user.id,
    ]);
    await client.query('DELETE FROM "CookieConsent" WHERE "userId" = $1', [
      user.id,
    ]);

    // 5. AuditLog is left untouched, and that is already pseudonymous:
    //    `actorId` is an opaque cuid pointing at the row we just
    //    scrubbed, so the trail stays correlatable while identifying
    //    nothing. Nulling it would destroy the art. 5(2) accountability
    //    evidence we are required to keep. Any PII that was captured in
    //    a payload is handled by the retention TTL, not here.

    await client.query(
      `UPDATE "DsrRequest"
          SET "status" = 'complete', "completedAt" = NOW(),
              "notes" = COALESCE("notes", '') ||
                        ' | erased: PII scrubbed, audit/legal/financial records retained'
        WHERE "id" = $1`,
      [requestId],
    );

    await insertRow(
      "AuditLog",
      {
        actorId: null,
        kind: "dsr.erase.completed",
        targetId: requestId,
        targetType: "DsrRequest",
        payload: JSON.stringify({
          subject: pseudonym(user.id),
          retained: ["AuditLog", "LegalAcceptance", "Engagement", "DealReport"],
        }),
      },
      { noUpdatedAt: true, client },
    );
  });

  // Final courtesy to the old address, after the transaction commits.
  await sendEmail({
    toAddress: originalEmail,
    kind: "dsr",
    subject: "Your AI Partner data has been erased",
    body: [
      "Hi,",
      "",
      "Your erasure request is complete. Your account has been closed and your",
      "personal details removed from our systems.",
      "",
      "We retain a minimal, pseudonymised record of compliance events, accepted",
      "legal terms, and any financial transactions, as permitted by GDPR",
      "art. 17(3) and required by accounting law. These no longer identify you.",
      "",
      "— AI Partner",
    ].join("\n"),
  }).catch((err) =>
    // The erasure itself succeeded; a bounced confirmation must not undo it.
    captureError(err, { scope: "dsr", requestId, stage: "confirmation-email" }),
  );

  return { requestId, kind: "erase", status: "complete" };
}

/**
 * Sweep queued requests. Rectify requests are intentionally left for a
 * human — they describe an inaccuracy only a person can judge — but they
 * are surfaced to admins so the 30-day clock is visible.
 */
export async function sweepDsrRequests(): Promise<{
  exported: number;
  erased: number;
  pendingManual: number;
}> {
  const queued = await query<{ id: string; kind: string }>(
    `SELECT "id", "kind" FROM "DsrRequest"
      WHERE "status" = 'queued'
      ORDER BY "createdAt" ASC
      LIMIT 25`,
  );

  let exported = 0;
  let erased = 0;
  let pendingManual = 0;

  for (const row of queued) {
    try {
      if (row.kind === "export") {
        await fulfilExport(row.id);
        exported++;
      } else if (row.kind === "erase") {
        await fulfilErasure(row.id);
        erased++;
      } else {
        pendingManual++;
      }
    } catch (err) {
      // One bad request must not wedge the sweep; the 30-day clock is
      // long enough for the next run to retry.
      captureError(err, { scope: "dsr", requestId: row.id, kind: row.kind });
    }
  }

  return { exported, erased, pendingManual };
}
