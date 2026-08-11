/**
 * AuthSession registry — the per-device session ledger.
 *
 * Auth.js manages the JWT cookie itself; we additionally record one
 * `AuthSession` row per `(user, browser)` so the user can see and
 * revoke individual devices, and so step-up MFA verification can be
 * tracked at the session level.
 *
 * Session rotation: we accept the cookie token as proof-of-identity
 * during the request, then look up the matching `AuthSession` by hash.
 * If the row is missing or revoked, the request is treated as
 * unauthenticated even though the JWT is otherwise valid.
 */

import "server-only";
import { query, queryOne, exec, insertRow } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";

export interface RegisterSessionInput {
  userId: string;
  /** Auth.js session token from the cookie. We never store the raw value. */
  token: string;
  ipHash: string | null;
  userAgent: string | null;
  /** Time-to-live in ms — defaults to 30 days. */
  ttlMs?: number;
}

export interface AuthSessionRow {
  id: string;
  userId: string;
  ipHash: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  mfaVerifiedAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Coarse "Chrome on macOS" label parsed from a UA string. */
export function deviceLabelFromUA(ua: string | null): string | null {
  if (!ua) return null;
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  let os = "Device";
  if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}

/** Idempotent register/refresh of a session row. */
export async function registerSession(
  input: RegisterSessionInput,
): Promise<void> {
  const tokenHash = sha256Hex(input.token);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));
  await insertRow(
    "AuthSession",
    {
      userId: input.userId,
      tokenHash,
      ipHash: input.ipHash,
      userAgent: input.userAgent ? input.userAgent.slice(0, 256) : null,
      deviceLabel: deviceLabelFromUA(input.userAgent),
      lastSeenAt: new Date(),
      expiresAt,
    },
    {
      noUpdatedAt: true,
      onConflict: `("tokenHash") DO UPDATE SET
        "lastSeenAt" = EXCLUDED."lastSeenAt",
        "ipHash" = COALESCE(EXCLUDED."ipHash", "AuthSession"."ipHash"),
        "userAgent" = COALESCE(EXCLUDED."userAgent", "AuthSession"."userAgent"),
        "deviceLabel" = COALESCE(EXCLUDED."deviceLabel", "AuthSession"."deviceLabel")`,
    },
  );
}

/** Update lastSeenAt — call lazily (e.g. once per N requests). */
export async function touchSession(token: string): Promise<void> {
  const tokenHash = sha256Hex(token);
  await exec(
    'UPDATE "AuthSession" SET "lastSeenAt" = NOW() WHERE "tokenHash" = $1',
    [tokenHash],
  ).catch(() => undefined);
}

/** Mark a single session revoked. The user can do this themselves. */
export async function revokeSession(opts: {
  userId: string;
  sessionId: string;
}): Promise<boolean> {
  const affected = await exec(
    `UPDATE "AuthSession" SET "revokedAt" = NOW()
     WHERE "id" = $1 AND "userId" = $2`,
    [opts.sessionId, opts.userId],
  );
  return affected > 0;
}

/** Mass-revoke every session for a user except (optionally) one. */
export async function revokeAllSessions(opts: {
  userId: string;
  exceptSessionId?: string;
}): Promise<number> {
  return exec(
    `UPDATE "AuthSession" SET "revokedAt" = NOW()
     WHERE "userId" = $1 AND "revokedAt" IS NULL
       AND ($2::text IS NULL OR "id" <> $2)`,
    [opts.userId, opts.exceptSessionId ?? null],
  );
}

/** List active (non-revoked, non-expired) sessions for a user. */
export async function listActiveSessions(
  userId: string,
): Promise<AuthSessionRow[]> {
  return query<AuthSessionRow>(
    `SELECT "id", "userId", "ipHash", "userAgent", "deviceLabel",
            "mfaVerifiedAt", "revokedAt", "lastSeenAt", "expiresAt", "createdAt"
     FROM "AuthSession"
     WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > NOW()
     ORDER BY "lastSeenAt" DESC`,
    [userId],
  );
}

/** Mark the current session as having passed an MFA challenge. */
export async function markMfaVerified(token: string): Promise<void> {
  const tokenHash = sha256Hex(token);
  await exec(
    'UPDATE "AuthSession" SET "mfaVerifiedAt" = NOW() WHERE "tokenHash" = $1',
    [tokenHash],
  ).catch(() => undefined);
}

/**
 * Step-up auth check: did the bearer of `token` complete an MFA
 * challenge in the last `windowSec` seconds? Returns false if the
 * session is unknown / revoked / expired.
 */
export async function isMfaFresh(
  token: string,
  windowSec: number,
): Promise<boolean> {
  const tokenHash = sha256Hex(token);
  const row = await queryOne<{
    mfaVerifiedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  }>(
    'SELECT "mfaVerifiedAt", "revokedAt", "expiresAt" FROM "AuthSession" WHERE "tokenHash" = $1',
    [tokenHash],
  );
  if (!row) return false;
  if (row.revokedAt) return false;
  if (row.expiresAt < new Date()) return false;
  if (!row.mfaVerifiedAt) return false;
  const ageSec = (Date.now() - row.mfaVerifiedAt.getTime()) / 1000;
  return ageSec <= windowSec;
}

/** Periodic cleanup: drop expired or long-revoked sessions. */
export async function cleanupSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  return exec(
    'DELETE FROM "AuthSession" WHERE "expiresAt" < NOW() OR "revokedAt" < $1',
    [cutoff],
  );
}
