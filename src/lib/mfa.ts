/**
 * Multi-factor authentication — TOTP (RFC 6238).
 *
 * Public surface:
 *   - `generateMfaEnrolment(user)` — returns a fresh secret + recovery codes
 *     and stores the encrypted secret. Call from the enrol-MFA action.
 *     The user MUST verify a TOTP code before we mark MFA enabled.
 *   - `enableMfa(userId, code)` — verifies the user can read codes from
 *     their authenticator and flips the credential to enabled.
 *   - `verifyTotp(userId, code)` — used during sign-in step-up.
 *   - `disableMfa(userId)` — wipes the credential (after step-up).
 *
 * Recovery codes: 10 single-use codes, hashed at rest (bcrypt) and shown
 * once. We accept either a TOTP code or a recovery code in `verifyTotp`.
 */

import "server-only";
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { queryOne, exec, insertRow, updateRows } from "@/lib/db";
import type { AuthMfaCredentialRow } from "@/lib/db/rows";
import { encryptString, decryptString, constantTimeEquals } from "@/lib/crypto";
import { env } from "@/env";

const ISSUER = "AI Partner";

/// Tolerate ±1 30-second window for clock drift between server and device.
const TOTP_WINDOW = 1;

/** Generate a new MFA enrolment record. Returns the *raw* secret + codes
 *  exactly once — the caller is expected to display them and never log
 *  them anywhere else. After this, all reads are encrypted. */
export async function generateMfaEnrolment(user: {
  id: string;
  email: string;
}) {
  const generated = speakeasy.generateSecret({
    name: `${ISSUER}:${user.email}`,
    issuer: ISSUER,
    length: 20,
  });
  const secret = generated.base32;
  const otpauthUrl = generated.otpauth_url ?? "";
  const recoveryCodes = Array.from({ length: 10 }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
  const recoveryHashes = await Promise.all(
    recoveryCodes.map((c) => bcrypt.hash(c, 10)),
  );

  await insertRow(
    "AuthMfaCredential",
    {
      userId: user.id,
      kind: "totp",
      secretCipher: encryptString(secret),
      recoveryCodes: JSON.stringify(recoveryHashes),
      enabledAt: null,
    },
    {
      onConflict: `("userId") DO UPDATE SET
        "secretCipher" = EXCLUDED."secretCipher",
        "recoveryCodes" = EXCLUDED."recoveryCodes",
        "enabledAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"`,
    },
  );

  return { secret, otpauthUrl, recoveryCodes };
}

/** Verify a TOTP code (or a recovery code). Updates `lastUsedAt` on
 *  success and burns the recovery code if used. */
export async function verifyTotp(
  userId: string,
  code: string,
): Promise<boolean> {
  if (!env.AUTH_SECRET && !env.AUDIT_HMAC_KEY) return false;
  const cred = await queryOne<AuthMfaCredentialRow>(
    'SELECT * FROM "AuthMfaCredential" WHERE "userId" = $1',
    [userId],
  );
  if (!cred) return false;

  const cleaned = code.trim().replace(/\s+/g, "").toUpperCase();

  // First try TOTP — six digits.
  if (/^\d{6}$/.test(cleaned)) {
    let secret: string;
    try {
      secret = decryptString(cred.secretCipher);
    } catch {
      return false;
    }
    const ok = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: cleaned,
      window: TOTP_WINDOW,
    });
    if (ok) {
      await updateRows(
        "AuthMfaCredential",
        { userId },
        { lastUsedAt: new Date() },
      );
      return true;
    }
    return false;
  }

  // Otherwise try recovery codes.
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(cred.recoveryCodes || "[]");
  } catch {
    hashes = [];
  }
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(cleaned, hashes[i])) {
      // Burn the code.
      hashes.splice(i, 1);
      await updateRows(
        "AuthMfaCredential",
        { userId },
        {
          recoveryCodes: JSON.stringify(hashes),
          lastUsedAt: new Date(),
        },
      );
      return true;
    }
  }
  return false;
}

/** Mark MFA enabled — only if the user can produce a valid code. */
export async function enableMfa(
  userId: string,
  code: string,
): Promise<boolean> {
  const ok = await verifyTotp(userId, code);
  if (!ok) return false;
  await updateRows("AuthMfaCredential", { userId }, { enabledAt: new Date() });
  return true;
}

/** Disable MFA — caller is expected to gate this with a step-up auth check. */
export async function disableMfa(userId: string): Promise<void> {
  await exec('DELETE FROM "AuthMfaCredential" WHERE "userId" = $1', [
    userId,
  ]).catch(() => undefined);
}

/** Cheap status check for UI — does the user have MFA enabled? */
export async function getMfaStatus(userId: string): Promise<{
  enrolled: boolean;
  enabled: boolean;
  remainingRecoveryCodes: number;
}> {
  const cred = await queryOne<{ enabledAt: Date | null; recoveryCodes: string }>(
    'SELECT "enabledAt", "recoveryCodes" FROM "AuthMfaCredential" WHERE "userId" = $1',
    [userId],
  );
  if (!cred) {
    return { enrolled: false, enabled: false, remainingRecoveryCodes: 0 };
  }
  let remaining = 0;
  try {
    remaining = JSON.parse(cred.recoveryCodes || "[]").length;
  } catch {
    remaining = 0;
  }
  return {
    enrolled: true,
    enabled: !!cred.enabledAt,
    remainingRecoveryCodes: remaining,
  };
}

// Re-export for cleanliness in callers that need only equality.
export { constantTimeEquals };
