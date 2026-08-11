/**
 * PostgreSQL data layer — node-postgres (`pg`), no ORM.
 *
 * Connection modes:
 *   - TCP: DATABASE_URL=postgresql://user:pass@host:5432/db
 *   - Cloud SQL (Cloud Run / App Engine): set DB_SOCKET_PATH to the
 *     unix socket dir (e.g. /cloudsql/PROJECT:REGION:INSTANCE) plus
 *     DB_USER / DB_PASSWORD / DB_NAME. The socket takes precedence.
 *
 * Conventions (carried over from the previous schema):
 *   - Table/column identifiers are camelCase/PascalCase and MUST be
 *     double-quoted in SQL.
 *   - `id` columns are TEXT with app-generated ids (`genId()`).
 *   - `updatedAt` has no DB default — `insertRow`/`updateRow` stamp it.
 */

import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { randomBytes } from "crypto";

// TIMESTAMP(3) columns are naive UTC — parse them as UTC, not local.
types.setTypeParser(types.builtins.TIMESTAMP, (v) => new Date(`${v}Z`));

function buildPool(): Pool {
  const socketPath = process.env.DB_SOCKET_PATH;
  if (socketPath) {
    // Cloud SQL unix socket (Auth Proxy mounts it in the service).
    return new Pool({
      host: socketPath,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
    });
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

// Singleton across Next.js dev hot reloads.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };
export const pool: Pool = globalForDb.__pgPool ?? buildPool();
if (process.env.NODE_ENV !== "production") globalForDb.__pgPool = pool;

/** Run a parameterized query; returns all rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as never[]);
  return result.rows;
}

/** Run a parameterized query; returns the first row or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a statement; returns the affected row count. */
export async function exec(
  text: string,
  params: unknown[] = [],
): Promise<number> {
  const result = await pool.query(text, params as never[]);
  return result.rowCount ?? 0;
}

/** COUNT(*) helper — returns a number (pg gives bigint as string). */
export async function count(
  text: string,
  params: unknown[] = [],
): Promise<number> {
  const row = await queryOne<{ count: string }>(text, params);
  return row ? Number(row.count) : 0;
}

/** Serializable unit of work. Rolls back on throw. */
export async function tx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * cuid2-shaped app-side id (24 chars, lowercase letter first) —
 * compatible with the TEXT id columns and existing data.
 */
export function genId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(24);
  let id = String.fromCharCode(97 + (bytes[0] % 26)); // letter first
  for (let i = 1; i < 24; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

// ─── Tiny CRUD builders (parameterized, identifier-quoted) ────

// Derived from db/schema.sql — tables where the helpers must NOT
// auto-stamp. Keep in sync when the DDL changes.
const TABLES_WITHOUT_UPDATED_AT = new Set([
  "ChatMessage",
  "Notification",
  "AuditLog",
  "FeatureFlagChange",
  "Email",
  "RateLimitBucket",
  "AuthSession",
  "RiskRadarReport",
  "NpsResponse",
  "DsrRequest",
  "BriefPresence",
  "AuthPasskeyChallenge",
  "CookieConsent",
  "SandboxSession",
  "LegalAcceptance",
  "ClarificationMessage",
]);
const TABLES_WITHOUT_ID = new Set([
  "FeatureFlag",
  "RateLimitBucket",
  "RetentionPolicy",
  "PlatformSetting",
  "NotificationTemplate",
]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function q(ident: string): string {
  if (!IDENT.test(ident)) throw new Error(`Unsafe identifier: ${ident}`);
  return `"${ident}"`;
}

export interface InsertOptions {
  client?: PoolClient;
  /** Skip auto-stamping (for tables without these columns). */
  noId?: boolean;
  noUpdatedAt?: boolean;
  /** ON CONFLICT clause, e.g. `("proposalId","key") DO UPDATE SET ...` */
  onConflict?: string;
}

/**
 * INSERT with auto `id` + `updatedAt` stamping. Returns the row.
 * `data` values pass through as parameters — never interpolated.
 */
export async function insertRow<T extends QueryResultRow = QueryResultRow>(
  table: string,
  data: Record<string, unknown>,
  opts: InsertOptions = {},
): Promise<T> {
  const row: Record<string, unknown> = { ...data };
  if (!opts.noId && !TABLES_WITHOUT_ID.has(table) && row.id === undefined) {
    row.id = genId();
  }
  if (
    !opts.noUpdatedAt &&
    !TABLES_WITHOUT_UPDATED_AT.has(table) &&
    row.updatedAt === undefined
  ) {
    row.updatedAt = new Date();
  }
  const keys = Object.keys(row);
  const cols = keys.map(q).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const conflict = opts.onConflict ? ` ON CONFLICT ${opts.onConflict}` : "";
  const text = `INSERT INTO ${q(table)} (${cols}) VALUES (${placeholders})${conflict} RETURNING *`;
  const executor = opts.client ?? pool;
  const result = await executor.query<T>(text, keys.map((k) => row[k]) as never[]);
  return result.rows[0];
}

export interface UpdateOptions {
  client?: PoolClient;
  noUpdatedAt?: boolean;
}

/**
 * UPDATE by equality-where. Returns affected rows.
 * Both `data` and `where` values are parameterized.
 */
export async function updateRows<T extends QueryResultRow = QueryResultRow>(
  table: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
  opts: UpdateOptions = {},
): Promise<T[]> {
  const patch: Record<string, unknown> = { ...data };
  if (
    !opts.noUpdatedAt &&
    !TABLES_WITHOUT_UPDATED_AT.has(table) &&
    patch.updatedAt === undefined
  ) {
    patch.updatedAt = new Date();
  }
  const dataKeys = Object.keys(patch);
  const whereKeys = Object.keys(where);
  if (whereKeys.length === 0) throw new Error("updateRows: empty WHERE");
  const sets = dataKeys.map((k, i) => `${q(k)} = $${i + 1}`).join(", ");
  const conds = whereKeys
    .map((k, i) => `${q(k)} = $${dataKeys.length + i + 1}`)
    .join(" AND ");
  const text = `UPDATE ${q(table)} SET ${sets} WHERE ${conds} RETURNING *`;
  const params = [...dataKeys.map((k) => patch[k]), ...whereKeys.map((k) => where[k])];
  const executor = opts.client ?? pool;
  const result = await executor.query<T>(text, params as never[]);
  return result.rows;
}
