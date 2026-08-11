/**
 * Public API key Server Actions.
 *
 *   - `createApiKey`  — provisions a new key, returns the raw value
 *                       exactly once (UI must surface "save this now").
 *   - `revokeApiKey`  — soft-revokes (status=revoked); the row is kept
 *                       so audits and historical lookups still work.
 *   - `listApiKeys`   — read helper for the dashboard.
 *
 * Key generation:
 *   - 24 random bytes → base32 (no padding, lowercase) → 39 chars.
 *   - Prefix `aip_live_` so the key is easy to spot in logs.
 *   - We store SHA-256(raw) only; the raw value is never persisted.
 *
 * Why base32 instead of base64url:
 *   - All-lowercase, alphanumeric, no `+`, `/`, `=`, `-`, `_`. Easier
 *     for ops to copy/paste, double-click select, and `grep`.
 */

"use server";

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { API_SCOPES } from "@/lib/public-api/scopes";

const RAW_PREFIX = "aip_live_";

const scopeSchema = z.enum(API_SCOPES as unknown as [string, ...string[]]);

export const createApiKey = defineAction({
  name: "apikey.create",
  permission: "apikey.create",
  rateLimit: { scope: "apikey.create", limit: 10, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    name: z.string().min(2).max(80),
    scopes: z.array(scopeSchema).min(1),
    /** Optional expiry (ISO-8601). NULL = never expires. */
    expiresAt: z.string().datetime().nullable().optional(),
    /** Optional per-key rate-limit override. */
    rateLimitRpm: z.number().int().min(10).max(10_000).nullable().optional(),
    ipAllowlist: z.array(z.string().ip()).max(20).optional(),
  }),
  output: z.object({
    id: z.string(),
    raw: z.string(),
    prefix: z.string(),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });

    // Only admins may mint owner keys.
    if (input.scopes.includes("*") && ctx.user.role !== "ADMIN") {
      throw fail({ code: "FORBIDDEN", reason: "owner-scope" });
    }

    const raw = await mintRawKey();
    const hashedKey = sha256Hex(raw);
    const prefix = raw.slice(0, RAW_PREFIX.length + 8);

    const row = await insertRow<{ id: string }>("PublicApiKey", {
      companyId: input.companyId,
      createdById: ctx.user.id,
      name: input.name,
      prefix,
      hashedKey,
      scopes: JSON.stringify(input.scopes),
      ipAllowlist: JSON.stringify(input.ipAllowlist ?? []),
      rateLimitRpm: input.rateLimitRpm ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });

    revalidatePath("/account/integrations");
    return { id: row.id, raw, prefix };
  },
});

export const revokeApiKey = defineAction({
  name: "apikey.revoke",
  permission: "apikey.revoke",
  rateLimit: { scope: "apikey.revoke", limit: 30, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    id: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const existing = await queryOne<{ companyId: string; status: string }>(
      'SELECT "companyId", "status" FROM "PublicApiKey" WHERE "id" = $1',
      [input.id],
    );
    if (!existing || existing.companyId !== input.companyId) {
      throw fail({ code: "NOT_FOUND" });
    }
    if (existing.status === "revoked") {
      return { ok: true as const, alreadyRevoked: true };
    }
    await updateRows(
      "PublicApiKey",
      { id: input.id },
      {
        status: "revoked",
        revokedAt: new Date(),
        revokedBy: ctx.user.id,
      },
    );
    revalidatePath("/account/integrations");
    return { ok: true as const, alreadyRevoked: false };
  },
});

/**
 * Server-side reader (no rate-limit needed). Hides hashedKey + secret.
 */
export async function listApiKeys(companyId: string) {
  return query<{
    id: string;
    name: string;
    prefix: string;
    scopes: string;
    status: string;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    rateLimitRpm: number | null;
    ipAllowlist: string;
    createdAt: Date;
    revokedAt: Date | null;
  }>(
    `SELECT "id", "name", "prefix", "scopes", "status", "lastUsedAt",
            "expiresAt", "rateLimitRpm", "ipAllowlist", "createdAt", "revokedAt"
     FROM "PublicApiKey"
     WHERE "companyId" = $1
     ORDER BY "status" ASC, "createdAt" DESC`,
    [companyId],
  );
}

/**
 * Generates a 24-byte (192-bit) random key encoded in lowercase base32.
 * 192 bits ≫ collision risk; sha256 of the raw is the lookup index.
 */
async function mintRawKey(): Promise<string> {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  // RFC 4648 base32, lowercase, no padding.
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 0x1f];
  }
  return `${RAW_PREFIX}${out}`;
}
