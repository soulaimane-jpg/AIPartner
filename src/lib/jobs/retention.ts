/**
 * Retention purge worker.
 *
 * Walks the `RetentionPolicy` table and deletes rows from each named
 * model whose `createdAt` is older than the configured `ttlDays`.
 * Safe to run nightly; idempotent.
 *
 * **Allow-list, not allow-all.** Only the models below can be purged.
 * Anything else is intentionally ignored — accidental retention on a
 * model we don't yet understand the dependencies of is far worse than
 * a noisy log line.
 *
 * Default policies live in `DEFAULT_RETENTION_POLICIES` and are
 * seeded once via `seedRetentionPolicies()`.
 */

import "server-only";
import { query, exec, insertRow } from "@/lib/db";

export const DEFAULT_RETENTION_POLICIES: { modelName: string; ttlDays: number }[] = [
  { modelName: "ChatMessage", ttlDays: 730 }, // 2 years
  { modelName: "Email", ttlDays: 730 },
  { modelName: "AuthSession", ttlDays: 30 },
  { modelName: "RateLimitBucket", ttlDays: 1 },
  { modelName: "RiskRadarReport", ttlDays: 365 },
  { modelName: "Notification", ttlDays: 365 },
  // Slice S5 — public API + sandbox + consent
  // SandboxSession: expire immediately after `expiresAt`; we keep the
  // row for one day past expiry to let observability ingest it before
  // we cascade-delete the synthetic tenant.
  { modelName: "SandboxSession", ttlDays: 1 },
  // WebhookDelivery: keep one week of delivery history so debuggers
  // can investigate failed pushes. Anything older has long since
  // been resolved or escalated.
  { modelName: "WebhookDelivery", ttlDays: 7 },
  // CookieConsent: 13 months matches the EDPB recommended max cookie
  // lifetime. Beyond that the audit row is no longer useful — the
  // visitor will have been re-prompted at least once.
  { modelName: "CookieConsent", ttlDays: 400 },
  // BriefAttachment: customer-uploaded documents, which routinely contain
  // personal data (names, org charts, salary lines). Matched to ChatMessage
  // so a brief's evidence and its conversation age out together.
  { modelName: "BriefAttachment", ttlDays: 730 },
];

/** Idempotent seed of default policies. Run once at deploy time. */
export async function seedRetentionPolicies(): Promise<void> {
  await Promise.all(
    DEFAULT_RETENTION_POLICIES.map((p) =>
      insertRow(
        "RetentionPolicy",
        { modelName: p.modelName, ttlDays: p.ttlDays },
        // Never overwrite an admin override.
        { onConflict: '("modelName") DO NOTHING' },
      ),
    ),
  );
}

export interface RetentionRunResult {
  deletedByModel: Record<string, number>;
  skippedUnsupported: string[];
}

/**
 * Run one purge pass. Returns counts per model so the cron route can
 * surface them in observability.
 */
export async function runRetention(): Promise<RetentionRunResult> {
  const policies = await query<{ modelName: string; ttlDays: number }>(
    // Global defaults; tenant overrides land in a later slice.
    'SELECT "modelName", "ttlDays" FROM "RetentionPolicy" WHERE "appliesTo" IS NULL',
  );

  const deletedByModel: Record<string, number> = {};
  const skippedUnsupported: string[] = [];

  for (const policy of policies) {
    const cutoff = new Date(Date.now() - policy.ttlDays * 86400 * 1000);
    const before = cutoff.toISOString();
    let deleted = 0;
    switch (policy.modelName) {
      case "ChatMessage":
        deleted = await exec(
          'DELETE FROM "ChatMessage" WHERE "createdAt" < $1',
          [cutoff],
        );
        break;
      case "Email":
        deleted = await exec('DELETE FROM "Email" WHERE "createdAt" < $1', [
          cutoff,
        ]);
        break;
      case "AuthSession":
        deleted = await exec(
          'DELETE FROM "AuthSession" WHERE "expiresAt" < NOW() OR "revokedAt" < $1',
          [new Date(Date.now() - policy.ttlDays * 86400 * 1000)],
        );
        break;
      case "RateLimitBucket":
        deleted = await exec(
          'DELETE FROM "RateLimitBucket" WHERE "resetAt" < $1',
          [cutoff],
        );
        break;
      case "RiskRadarReport":
        deleted = await exec(
          'DELETE FROM "RiskRadarReport" WHERE "createdAt" < $1',
          [cutoff],
        );
        break;
      case "Notification":
        deleted = await exec(
          'DELETE FROM "Notification" WHERE "read" = TRUE AND "createdAt" < $1',
          [cutoff],
        );
        break;
      case "SandboxSession":
        // Two-phase purge: first delete sessions whose `expiresAt` is
        // older than (now − ttl), then cascade-delete the synthetic
        // user + company they pointed at. Cascade is driven by the
        // FK `onDelete: Cascade` on demoUser/demoBrief.
        deleted = await purgeExpiredSandboxSessions(cutoff);
        break;
      case "WebhookDelivery":
        deleted = await exec(
          'DELETE FROM "WebhookDelivery" WHERE "createdAt" < $1',
          [cutoff],
        );
        break;
      case "CookieConsent":
        deleted = await exec(
          'DELETE FROM "CookieConsent" WHERE "createdAt" < $1',
          [cutoff],
        );
        break;
      case "BriefAttachment":
        deleted = await purgeExpiredAttachments(cutoff);
        break;
      default:
        // Anything not in the allow-list is silently skipped.
        skippedUnsupported.push(policy.modelName);
        continue;
    }
    deletedByModel[policy.modelName] = deleted;
    if (deleted > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[retention] purged ${deleted} ${policy.modelName} rows older than ${before}`,
      );
    }
  }

  return { deletedByModel, skippedUnsupported };
}

/**
 * Purge expired brief attachments, bucket object included.
 *
 * Deleting only the row would leave the file itself sitting in Cloud Storage
 * indefinitely — the row is what we can see, but the object is what actually
 * holds the personal data, so erasure has to cover both.
 *
 * Object deletes are best-effort (`deleteObject` swallows failures). A missed
 * object is caught by the bucket lifecycle rule; a missed *row* would be worse,
 * because it keeps feeding the file's text into AI prompts.
 */
async function purgeExpiredAttachments(cutoff: Date): Promise<number> {
  const expired = await query<{ id: string; storagePath: string }>(
    'SELECT "id", "storagePath" FROM "BriefAttachment" WHERE "createdAt" < $1',
    [cutoff],
  );
  if (expired.length === 0) return 0;

  const { deleteObject, isStorageConfigured } = await import("@/lib/storage/gcs");
  if (isStorageConfigured()) {
    for (const row of expired) {
      await deleteObject(row.storagePath);
    }
  }

  return exec('DELETE FROM "BriefAttachment" WHERE "id" = ANY($1)', [
    expired.map((r) => r.id),
  ]);
}

/**
 * Purge expired sandbox sessions and their synthetic tenants.
 *
 * The `SandboxSession.demoUserId` / `demoBriefId` columns are loose
 * string references (no FK), so cascade deletes don't fire
 * automatically. We delete the demo user — which cascades to their
 * brief, matches, company-assignments, etc. — then delete the
 * session row.
 *
 * Returns the number of session rows removed.
 */
async function purgeExpiredSandboxSessions(cutoff: Date): Promise<number> {
  // Anything whose `expiresAt` is older than the retention cutoff
  // (i.e., the session expired AND we waited the TTL grace period).
  const expired = await query<{ id: string; demoUserId: string | null }>(
    'SELECT "id", "demoUserId" FROM "SandboxSession" WHERE "expiresAt" < $1',
    [cutoff],
  );
  if (expired.length === 0) return 0;

  // Wipe the synthetic users — Company kind="CUSTOMER" + briefs cascade
  // via existing schema relations on User.companyId etc.
  const demoUserIds = expired
    .map((s) => s.demoUserId)
    .filter((id): id is string => Boolean(id));

  if (demoUserIds.length > 0) {
    // Find the company id(s) so we can wipe the synthetic tenant too.
    const users = await query<{ id: string; companyId: string | null }>(
      'SELECT "id", "companyId" FROM "User" WHERE "id" = ANY($1)',
      [demoUserIds],
    );
    await exec('DELETE FROM "User" WHERE "id" = ANY($1)', [demoUserIds]);
    const companyIds = Array.from(
      new Set(users.map((u) => u.companyId).filter((c): c is string => Boolean(c))),
    );
    if (companyIds.length > 0) {
      await exec('DELETE FROM "Company" WHERE "id" = ANY($1)', [companyIds]);
    }
  }

  return exec('DELETE FROM "SandboxSession" WHERE "id" = ANY($1)', [
    expired.map((s) => s.id),
  ]);
}
