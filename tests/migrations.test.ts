/**
 * Migration hygiene.
 *
 * `scripts/migrate.sh` applies each file with `--single-transaction`,
 * together with its `_migration` tracking row, so the two commit or roll
 * back as one. An explicit `COMMIT;` inside a migration ends that wrapper
 * early: the DDL commits and the tracking INSERT then runs in autocommit,
 * so a failure between them leaves a migration applied but unrecorded —
 * and the next run would apply it again.
 *
 * `20260812_timestamptz.sql` shipped with exactly that bug. It produced
 * `WARNING: there is already a transaction in progress` followed by
 * `WARNING: there is no transaction in progress` on a real production run.
 * It is grandfathered below rather than edited, because changing an applied
 * migration trips migrate.sh's checksum-drift check and would break every
 * subsequent run.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = resolve(process.cwd(), "db/migrations");

/**
 * Applied to production before the rule existed, and therefore frozen:
 * editing an applied migration trips migrate.sh's checksum-drift check and
 * would break every subsequent run.
 *
 * Do NOT add to this list to silence a NEW migration — remove the
 * BEGIN/COMMIT instead.
 *
 *   - 20260712_company_workspace_v1.sql — pre-existing, from the launch
 *     commit, applied 2026-07-27. Found by this test, not by a human.
 *   - 20260812_timestamptz.sql — applied 2026-08-12; the warnings it emitted
 *     on the production run are what prompted writing this test.
 */
const GRANDFATHERED = new Set([
  "20260712_company_workspace_v1.sql",
  "20260812_timestamptz.sql",
]);

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => statSync(join(MIGRATIONS, f)).isFile())
    .sort();
}

/** Strip comments so a `BEGIN` inside prose doesn't trip the check. */
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

describe("migration files", () => {
  const files = migrationFiles();

  it("there are migrations to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("never manage their own transaction — migrate.sh already wraps them", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (GRANDFATHERED.has(f)) continue;
      const sql = stripSqlComments(readFileSync(join(MIGRATIONS, f), "utf8"));
      // Word-boundary match, and ignore the BEGIN that opens a PL/pgSQL
      // block (`DO $$ BEGIN … END $$;`), which is control flow, not a
      // transaction.
      const withoutDoBlocks = sql.replace(
        /DO\s*\$\$[\s\S]*?\$\$\s*;/gi,
        "",
      );
      if (/\bBEGIN\s*;/i.test(withoutDoBlocks)) offenders.push(`${f}: BEGIN;`);
      if (/\bCOMMIT\s*;/i.test(withoutDoBlocks)) offenders.push(`${f}: COMMIT;`);
      if (/\bROLLBACK\s*;/i.test(withoutDoBlocks)) {
        offenders.push(`${f}: ROLLBACK;`);
      }
    }
    expect(
      offenders,
      `Migrations must not open their own transaction — scripts/migrate.sh applies
each file with --single-transaction alongside its tracking row. An explicit
COMMIT ends that wrapper early and can leave the migration applied but
unrecorded. Use SET LOCAL and DO blocks instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the grandfathered files are the only exceptions, and are documented", () => {
    // If someone deletes the file, drop it from the set too.
    for (const f of GRANDFATHERED) {
      expect(files, `${f} is grandfathered but no longer exists`).toContain(f);
    }
    // Pinned so the list can't quietly grow.
    expect(GRANDFATHERED.size).toBe(2);
    expect(readFileSync(resolve(process.cwd(), "scripts/migrate.sh"), "utf8"))
      .toContain("do NOT put `BEGIN;` / `COMMIT;` in the file");
  });

  it("rollback scripts DO manage their own transaction — they run standalone", () => {
    // The inverse rule: these are applied by hand with `psql -f`, so they
    // need explicit boundaries.
    const dir = join(MIGRATIONS, "rollback");
    const rollbacks = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    expect(rollbacks.length).toBeGreaterThan(0);
    for (const f of rollbacks) {
      const sql = readFileSync(join(dir, f), "utf8");
      expect(sql, `${f} should wrap itself`).toMatch(/\bBEGIN\s*;/i);
      expect(sql, `${f} should commit`).toMatch(/\bCOMMIT\s*;/i);
    }
  });

  it("uses IF NOT EXISTS or an exception guard so re-runs are safe", () => {
    // migrate.sh runs each file once, but a restored-from-backup database or
    // a manual replay must not explode.
    const risky: string[] = [];
    for (const f of files) {
      const sql = stripSqlComments(readFileSync(join(MIGRATIONS, f), "utf8"));
      const creates = /CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\s+(?!IF\s+NOT\s+EXISTS)/i.test(
        sql,
      );
      const guarded = /EXCEPTION|IF\s+NOT\s+EXISTS|DO\s*\$\$/i.test(sql);
      if (creates && !guarded) risky.push(f);
    }
    expect(
      risky,
      `Add IF NOT EXISTS (or an EXCEPTION guard) so a replay is safe:\n${risky.join("\n")}`,
    ).toEqual([]);
  });
});
