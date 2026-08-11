/**
 * Public-API bearer-key authentication.
 *
 * Routes under `/api/v1/*` call `authenticateApiKey(request)` first.
 * The function returns a typed `ApiAuth` context (companyId + scopes)
 * or a `Response` to short-circuit the route with 401/403/429.
 *
 * Key format: `aip_live_<24+ random base32 chars>`. We hash the raw
 * key with SHA-256 (same hash we stored at create time) and look up
 * the row in O(1) via the unique index. Constant-time comparison is
 * implicit in the index lookup — there's no plaintext loop.
 *
 * Rate limiting: per-key, sliding window. Default 60 req/min; an
 * operator can raise it on a key via `rateLimitRpm`.
 *
 * IP allowlist: optional JSON array on the key. When set, the request
 * IP must match one of the entries (CIDR not yet supported — keep it
 * simple for v1; literal addresses only).
 */

import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { queryOne, updateRows } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ApiAuth {
  keyId: string;
  companyId: string;
  scopes: string[];
  /** Hashed key — surfaced for downstream audit + log redaction. */
  hashedKey: string;
}

export type ApiAuthResult =
  | { ok: true; auth: ApiAuth }
  | { ok: false; response: Response };

const KEY_PREFIX = "aip_live_";

/**
 * Hash + look up the bearer credential.
 *
 * Returns either an `ApiAuth` context the route handler should use,
 * or a `Response` the handler should return verbatim (so error
 * shapes are uniform across `/api/v1/*`).
 */
export async function authenticateApiKey(
  req: NextRequest,
  options: { requiredScopes?: string[] } = {},
): Promise<ApiAuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) {
    return { ok: false, response: error401("missing_bearer") };
  }
  const raw = m[1].trim();
  if (!raw.startsWith(KEY_PREFIX) || raw.length < KEY_PREFIX.length + 16) {
    return { ok: false, response: error401("malformed_key") };
  }

  const hashedKey = sha256Hex(raw);
  const row = await queryOne<{
    id: string;
    companyId: string;
    scopes: string;
    status: string;
    ipAllowlist: string;
    rateLimitRpm: number | null;
    expiresAt: Date | null;
  }>(
    `SELECT "id", "companyId", "scopes", "status", "ipAllowlist", "rateLimitRpm", "expiresAt"
     FROM "PublicApiKey" WHERE "hashedKey" = $1`,
    [hashedKey],
  );
  if (!row) {
    return { ok: false, response: error401("invalid_key") };
  }
  if (row.status !== "active") {
    return { ok: false, response: error401("revoked") };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, response: error401("expired") };
  }

  // IP allowlist
  const allowlist = parseStringArray(row.ipAllowlist);
  if (allowlist.length > 0) {
    const ip = clientIp(req);
    if (!ip || !allowlist.includes(ip)) {
      return { ok: false, response: error403("ip_not_allowed") };
    }
  }

  // Per-key rate limit (sliding minute).
  const rpm = row.rateLimitRpm ?? 60;
  const rl = await checkRateLimit({
    key: `apikey:${row.id}:rpm`,
    limit: rpm,
    windowSec: 60,
  });
  if (rl.limited) {
    return { ok: false, response: error429(rl.retryAfterSec) };
  }

  // Scope check
  const scopes = parseStringArray(row.scopes);
  for (const need of options.requiredScopes ?? []) {
    if (!scopes.includes(need) && !scopes.includes("*")) {
      return { ok: false, response: error403(`scope:${need}`) };
    }
  }

  // Update lastUsedAt out-of-band — never await, never throw.
  void updateRows("PublicApiKey", { id: row.id }, { lastUsedAt: new Date() }).catch(
    () => undefined,
  );

  return {
    ok: true,
    auth: {
      keyId: row.id,
      companyId: row.companyId,
      scopes,
      hashedKey,
    },
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function error401(reason: string): Response {
  return NextResponse.json(
    {
      error: { code: "UNAUTHENTICATED", reason },
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="aipartner"' },
    },
  );
}

function error403(reason: string): Response {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", reason } },
    { status: 403 },
  );
}

function error429(retryAfterSec: number): Response {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", retryAfterSec } },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
