/**
 * Rate limiter — fixed-window, swappable backend.
 *
 * Today: DB-backed (`RateLimitBucket`) so it works on any deploy with no
 * extra infra. Tomorrow: Upstash Redis (set `RATE_LIMIT_BACKEND=redis`).
 *
 * The window is fixed-by-second; for the frequency we operate at this is
 * fine. We can upgrade to a sliding-window or token bucket when we add
 * Redis without changing call sites.
 */

import "server-only";
import { queryOne, exec } from "@/lib/db";
import { env } from "@/env";

export interface RateLimitInput {
  /** Composite key, e.g. "ip:1.2.3.4:signin" or "user:abc:brief.create". */
  key: string;
  /** Max requests within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
}

/** Public API — call from any Server Action. */
export async function checkRateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_BACKEND === "memory") return checkMemory(input);
  // "redis" support intentionally not yet wired — fall through to DB.
  return checkDb(input);
}

// ─── DB backend ───────────────────────────────────────────────────

async function checkDb(input: RateLimitInput): Promise<RateLimitResult> {
  const now = new Date();
  const windowResetAt = new Date(now.getTime() + input.windowSec * 1000);
  // Single atomic round-trip: start a new window when expired,
  // otherwise increment the current one.
  const row = await queryOne<{ count: number; resetAt: Date }>(
    `INSERT INTO "RateLimitBucket" ("key", "count", "windowSec", "resetAt")
     VALUES ($1, 1, $2, $3)
     ON CONFLICT ("key") DO UPDATE SET
       "count"     = CASE WHEN "RateLimitBucket"."resetAt" <= $4 THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
       "windowSec" = $2,
       "resetAt"   = CASE WHEN "RateLimitBucket"."resetAt" <= $4 THEN $3 ELSE "RateLimitBucket"."resetAt" END
     RETURNING "count", "resetAt"`,
    [input.key, input.windowSec, windowResetAt, now],
  );

  const bucketCount = row?.count ?? 1;
  const resetAt = row?.resetAt ?? windowResetAt;
  const limited = bucketCount > input.limit;
  return {
    limited,
    remaining: Math.max(0, input.limit - bucketCount),
    resetAt,
    retryAfterSec: limited
      ? Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
      : 0,
  };
}

// ─── In-memory backend (tests + dev) ──────────────────────────────

const memoryStore = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkMemory(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(input.key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + input.windowSec * 1000;
    memoryStore.set(input.key, { count: 1, resetAt });
    return {
      limited: false,
      remaining: input.limit - 1,
      resetAt: new Date(resetAt),
      retryAfterSec: 0,
    };
  }
  entry.count += 1;
  const limited = entry.count > input.limit;
  return {
    limited,
    remaining: Math.max(0, input.limit - entry.count),
    resetAt: new Date(entry.resetAt),
    retryAfterSec: limited
      ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
      : 0,
  };
}

/**
 * Periodic cleanup of expired buckets. Called from a cron later;
 * no-op safe to invoke ad-hoc in the meantime.
 */
export async function cleanupExpiredBuckets(): Promise<number> {
  return exec('DELETE FROM "RateLimitBucket" WHERE "resetAt" < $1', [
    new Date(),
  ]);
}
