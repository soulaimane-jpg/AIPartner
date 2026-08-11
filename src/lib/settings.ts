/**
 * PlatformSettings service — plan-A §7.
 *
 * All timer durations and behaviour toggles are configuration, not
 * constants (golden rule 4). Values live in the `PlatformSetting`
 * table as JSON-encoded strings; unknown keys fall back to the
 * defaults below and are lazily seeded on first read so the admin
 * Settings page always shows a complete list.
 */

import "server-only";
import { query, queryOne, insertRow } from "@/lib/db";
import type { PlatformSettingRow } from "@/lib/db/rows";

export interface SettingDef<T> {
  key: string;
  default: T;
  description: string;
}

export const SETTING_DEFS = {
  lead_accept_hours: {
    key: "lead_accept_hours",
    default: 48,
    description:
      "Timer 1 — hours a partner has to accept/decline a lead invite (session range 24–48h).",
  } as SettingDef<number>,
  proposal_submit_hours: {
    key: "proposal_submit_hours",
    default: 48,
    description:
      "Timer 2 — hours a partner has to submit the proposal after accepting. Admin can override per lead at invite time.",
  } as SettingDef<number>,
  extension_hours: {
    key: "extension_hours",
    default: 24,
    description: "Hours added by the one-time proposal deadline extension.",
  } as SettingDef<number>,
  company_select_hours: {
    key: "company_select_hours",
    default: 48,
    description:
      "Hours the company has to select partners after the comparison is released.",
  } as SettingDef<number>,
  stagger_hours: {
    key: "stagger_hours",
    default: 2,
    description:
      "Minimum gap between comparison-column releases (submission-order stagger).",
  } as SettingDef<number>,
  reminder_offsets_hours: {
    key: "reminder_offsets_hours",
    default: [24, 4],
    description:
      "Hours-before-expiry offsets at which deadline reminders are sent.",
  } as SettingDef<number[]>,
  weekend_leeway_mode: {
    key: "weekend_leeway_mode",
    default: "off",
    description:
      "Weekend handling for timers: off | pause | pad (P1 behaviour; off = no adjustment).",
  } as SettingDef<string>,
  competitive_notifications_enabled: {
    key: "competitive_notifications_enabled",
    default: true,
    description:
      '"War-zone" notifications — tell accepted partners when a competitor submits.',
  } as SettingDef<boolean>,
  brief_draft_reminder_days: {
    key: "brief_draft_reminder_days",
    default: 5,
    description: "Days before an abandoned draft brief triggers a reminder.",
  } as SettingDef<number>,
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;

// Small in-process cache — settings change rarely; 30s TTL keeps the
// sweep loop cheap without making the admin UI feel stale.
const cache = new Map<string, { value: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

function readCache<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  cache.delete(key);
  return undefined;
}

function writeCache(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Read a setting, seeding the default row on first access. */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<(typeof SETTING_DEFS)[K]["default"]> {
  type V = (typeof SETTING_DEFS)[K]["default"];
  const cached = readCache<V>(key);
  if (cached !== undefined) return cached;

  const def = SETTING_DEFS[key];
  const row = await queryOne<PlatformSettingRow>(
    'SELECT * FROM "PlatformSetting" WHERE "key" = $1',
    [key],
  );
  if (!row) {
    // Lazy-seed so the admin settings page lists every key.
    await insertRow(
      "PlatformSetting",
      {
        key,
        value: JSON.stringify(def.default),
        description: def.description,
      },
      { noId: true, onConflict: '("key") DO NOTHING' }, // race-safe: another request seeded it
    ).catch(() => undefined);
    writeCache(key, def.default);
    return def.default as V;
  }
  try {
    const parsed = JSON.parse(row.value) as V;
    writeCache(key, parsed);
    return parsed;
  } catch {
    writeCache(key, def.default);
    return def.default as V;
  }
}

/** Write a setting (admin action). Invalidates the cache. */
export async function setSetting(
  key: SettingKey,
  value: unknown,
  updatedBy?: string,
): Promise<void> {
  const def = SETTING_DEFS[key];
  await insertRow(
    "PlatformSetting",
    {
      key,
      value: JSON.stringify(value),
      description: def.description,
      updatedBy: updatedBy ?? null,
    },
    {
      noId: true,
      onConflict:
        '("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = EXCLUDED."updatedAt"',
    },
  );
  cache.delete(key);
}

/** All settings with metadata — for the admin Settings page. */
export async function listSettings(): Promise<
  Array<{
    key: SettingKey;
    value: unknown;
    default: unknown;
    description: string;
    updatedAt: Date | null;
    updatedBy: string | null;
  }>
> {
  const rows = await query<PlatformSettingRow>('SELECT * FROM "PlatformSetting"');
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return (Object.keys(SETTING_DEFS) as SettingKey[]).map((key) => {
    const def = SETTING_DEFS[key];
    const row = byKey.get(key);
    let value: unknown = def.default;
    if (row) {
      try {
        value = JSON.parse(row.value);
      } catch {
        value = def.default;
      }
    }
    return {
      key,
      value,
      default: def.default,
      description: def.description,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}
