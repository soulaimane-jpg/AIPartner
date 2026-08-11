import "server-only";

import { createHash } from "node:crypto";
import { queryOne } from "@/lib/db";
import { env } from "@/env";

/**
 * Password reset token helpers.
 *
 * Kept out of `@/lib/actions/auth` on purpose: everything exported from a
 * `"use server"` module becomes a callable endpoint, and `isPasswordResetTokenValid`
 * would then be a public oracle for probing token validity. These are plain
 * server-only functions instead.
 */

export const RESET_TOKEN_TTL_MINUTES = 60;

/** Only the hash is ever stored, so a DB leak can't be replayed. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/auth/reset/${token}`;
}

/** Resolve a raw token to its still-usable row, or null. */
export async function findUsableResetToken(
  token: string,
): Promise<{ id: string; userId: string } | null> {
  if (!token || token.length < 16) return null;
  return queryOne<{ id: string; userId: string }>(
    `SELECT "id", "userId" FROM "PasswordResetToken"
      WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()`,
    [hashResetToken(token)],
  );
}

export async function isPasswordResetTokenValid(
  token: string,
): Promise<boolean> {
  return Boolean(await findUsableResetToken(token));
}
