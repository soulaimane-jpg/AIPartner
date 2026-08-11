/**
 * Symmetric encryption helpers — AES-256-GCM.
 *
 * Used for secrets we have to store but must never read in plain text
 * after the fact (e.g. TOTP secrets, SCIM tokens, webhook signing
 * secrets). Key material comes from `AUDIT_HMAC_KEY` (rotated yearly);
 * a missing key in production is a hard boot failure.
 *
 * Format: `<iv-base64>.<authTag-base64>.<ciphertext-base64>`
 *
 * Why not Vault/KMS today: we want zero extra infra. The interface
 * below is identical to what KMS will look like, so the swap is local.
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "@/env";

const ALGO = "aes-256-gcm" as const;
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32; // AES-256

function deriveKey(): Buffer {
  const raw = env.AUDIT_HMAC_KEY ?? env.AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "Encryption requires AUDIT_HMAC_KEY (or AUTH_SECRET in dev). None set.",
    );
  }
  // SHA-256 yields exactly 32 bytes — a fine derivation when the input
  // already has high entropy (we require ≥ 32 chars upstream).
  return createHash("sha256").update(raw).digest().subarray(0, KEY_BYTES);
}

/** Encrypt UTF-8 text. Result is safe to store as a single string column. */
export function encryptString(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Decrypt a string produced by `encryptString`. Throws on tamper / wrong key. */
export function decryptString(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivB, tagB, dataB] = parts;
  const iv = Buffer.from(ivB, "base64url");
  const authTag = Buffer.from(tagB, "base64url");
  const data = Buffer.from(dataB, "base64url");
  const decipher = createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Constant-time string comparison — use for token + code matching. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** SHA-256 hex digest of a token — for storing without the raw value. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
