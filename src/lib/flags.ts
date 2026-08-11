/**
 * Feature flags — server-side evaluation with audit trail.
 *
 * **Why DB-backed?** Cheap, always-available, transactional with
 * everything else, no extra vendor. We can swap to LaunchDarkly later
 * by re-implementing the same surface — no call-site changes needed.
 *
 * **Evaluation order**:
 *   1. Flag missing or `enabled = false` → off.
 *   2. Audience match (role / userId / companyId) → on.
 *   3. Bucket the actor into 0..99 by stable hash → on iff bucket < rolloutPct.
 *
 * **Caching.** Flags are read on every action that asks; we keep a
 * 30-second in-process cache to avoid hammering the DB. Stale-while-
 * revalidate is fine for feature flags.
 */

import "server-only";
import { createHash } from "node:crypto";
import { query, tx as dbTx, genId } from "@/lib/db";
// Note: "FeatureFlag" is keyed by "key" (no id column); "FeatureFlagChange" has no updatedAt.
import type { FeatureFlagRow } from "@/lib/db/rows";
import type { ActionContext } from "@/lib/rbac/types";

interface FlagAudience {
  roles?: string[];
  userIds?: string[];
  companyIds?: string[];
}

interface FlagRecord {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  audience: FlagAudience;
}

const CACHE_TTL_MS = 30_000;
let cache: { ts: number; map: Map<string, FlagRecord> } = {
  ts: 0,
  map: new Map(),
};

async function loadAll(): Promise<Map<string, FlagRecord>> {
  if (Date.now() - cache.ts < CACHE_TTL_MS) return cache.map;
  const rows = await query<FeatureFlagRow>('SELECT * FROM "FeatureFlag"');
  const map = new Map<string, FlagRecord>();
  for (const row of rows) {
    let audience: FlagAudience = {};
    try {
      audience = row.audience ? JSON.parse(row.audience) : {};
    } catch {
      audience = {};
    }
    map.set(row.key, {
      key: row.key,
      enabled: row.enabled,
      rolloutPct: Math.max(0, Math.min(100, row.rolloutPct)),
      audience,
    });
  }
  cache = { ts: Date.now(), map };
  return map;
}

/** Stable 0..99 bucket for a given key+actor pair. */
function bucket(key: string, actorId: string | null): number {
  const seed = `${key}|${actorId ?? "anon"}`;
  const hash = createHash("sha256").update(seed).digest();
  // Take the first 4 bytes as an unsigned int.
  const n = hash.readUInt32BE(0);
  return n % 100;
}

/** Server-side flag evaluation. Safe to call from any Server Action. */
export async function getFlag(
  key: string,
  ctx: ActionContext | null,
): Promise<boolean> {
  const map = await loadAll();
  const flag = map.get(key);
  if (!flag) return false;
  if (!flag.enabled) return false;

  const u = ctx?.user;
  if (u) {
    if (flag.audience.userIds?.includes(u.id)) return true;
    if (u.companyId && flag.audience.companyIds?.includes(u.companyId))
      return true;
    if (flag.audience.roles?.includes(u.role)) return true;
  }

  if (flag.rolloutPct >= 100) return true;
  if (flag.rolloutPct <= 0) return false;
  return bucket(key, u?.id ?? null) < flag.rolloutPct;
}

/** Bust the in-process cache (call after mutating a flag). */
export function invalidateFlagCache(): void {
  cache = { ts: 0, map: new Map() };
}

/**
 * Toggle a flag — admin-only entry point. Records a `FeatureFlagChange`
 * row for audit. Always re-fetches the flag inside a transaction to
 * avoid lost-update races.
 */
export async function setFlag(opts: {
  actorId: string | null;
  key: string;
  patch: Partial<{
    enabled: boolean;
    rolloutPct: number;
    audience: FlagAudience;
    description: string | null;
    ownerEmail: string | null;
    expiresAt: Date | null;
  }>;
  reason?: string;
}): Promise<void> {
  await dbTx(async (client) => {
    const { rows } = await client.query<FeatureFlagRow>(
      'SELECT * FROM "FeatureFlag" WHERE "key" = $1',
      [opts.key],
    );
    const existing = rows[0] ?? null;
    const before = existing
      ? {
          enabled: existing.enabled,
          rolloutPct: existing.rolloutPct,
          audience: JSON.parse(existing.audience || "{}"),
          description: existing.description,
          ownerEmail: existing.ownerEmail,
          expiresAt: existing.expiresAt,
        }
      : null;

    const after = {
      enabled: opts.patch.enabled ?? existing?.enabled ?? false,
      rolloutPct: opts.patch.rolloutPct ?? existing?.rolloutPct ?? 0,
      audience: opts.patch.audience ?? before?.audience ?? {},
      description:
        opts.patch.description ?? existing?.description ?? null,
      ownerEmail: opts.patch.ownerEmail ?? existing?.ownerEmail ?? null,
      expiresAt: opts.patch.expiresAt ?? existing?.expiresAt ?? null,
    };

    await client.query(
      `INSERT INTO "FeatureFlag"
         ("key", "enabled", "rolloutPct", "audience", "description", "ownerEmail", "expiresAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT ("key") DO UPDATE SET
         "enabled" = EXCLUDED."enabled",
         "rolloutPct" = EXCLUDED."rolloutPct",
         "audience" = EXCLUDED."audience",
         "description" = EXCLUDED."description",
         "ownerEmail" = EXCLUDED."ownerEmail",
         "expiresAt" = EXCLUDED."expiresAt",
         "updatedAt" = NOW()`,
      [
        opts.key,
        after.enabled,
        after.rolloutPct,
        JSON.stringify(after.audience),
        after.description,
        after.ownerEmail,
        after.expiresAt,
      ],
    );

    await client.query(
      `INSERT INTO "FeatureFlagChange"
         ("id", "flagKey", "actorId", "before", "after", "reason")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        genId(),
        opts.key,
        opts.actorId,
        JSON.stringify(before ?? {}),
        JSON.stringify(after),
        opts.reason ?? null,
      ],
    );
  });
  invalidateFlagCache();
}
