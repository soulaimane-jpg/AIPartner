import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { exec, insertRow, queryOne } from "@/lib/db";
import { env } from "@/env";

/**
 * Email verification token helpers.
 *
 * Kept out of any `"use server"` module on purpose: everything exported
 * from one becomes a callable endpoint, and a token-validity checker
 * would then be a public oracle. Plain server-only functions instead —
 * same design as `password-reset.ts`.
 */

export const VERIFICATION_TOKEN_TTL_HOURS = 48;

/** Only the hash is ever stored, so a DB leak can't be replayed. */
export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verificationUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/auth/verify/${token}`;
}

/**
 * Mint a fresh token for a user, invalidating any outstanding one so a
 * resend can't leave two live links.
 */
export async function createVerificationToken(opts: {
  userId: string;
  email: string;
}): Promise<string> {
  await exec(
    `UPDATE "EmailVerificationToken" SET "usedAt" = NOW()
      WHERE "userId" = $1 AND "usedAt" IS NULL`,
    [opts.userId],
  );

  const token = randomBytes(32).toString("hex");
  await insertRow(
    "EmailVerificationToken",
    {
      userId: opts.userId,
      email: opts.email.toLowerCase(),
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(
        Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
      ),
    },
    { noUpdatedAt: true },
  );
  return token;
}

/** Resolve a raw token to its still-usable row, or null. */
export async function findUsableVerificationToken(
  token: string,
): Promise<{ id: string; userId: string; email: string } | null> {
  if (!token || token.length < 16) return null;
  return queryOne<{ id: string; userId: string; email: string }>(
    `SELECT "id", "userId", "email" FROM "EmailVerificationToken"
      WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()`,
    [hashVerificationToken(token)],
  );
}
