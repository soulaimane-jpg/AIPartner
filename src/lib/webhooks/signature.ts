/**
 * HMAC-SHA256 webhook signature.
 *
 * Format we sign over: `${timestampSeconds}.${rawBody}`. The result
 * goes on the wire as `X-AIPartner-Signature: t=<ts>,v1=<hex>`.
 *
 * Why this layout (mirrors Stripe / Slack):
 *   - Including the timestamp prevents replay attacks — consumers
 *     verify the timestamp is within ±5 minutes of "now".
 *   - The `v1=` prefix lets us roll the signature scheme without
 *     breaking existing consumers (we'd add `v2=` alongside).
 *   - The newline-delimited concatenation is unambiguous and easy to
 *     reproduce in any language.
 *
 * Verification on the consumer side (sample, in any HMAC-aware lang):
 *   1. Split `t=...,v1=...` from `X-AIPartner-Signature`.
 *   2. Reject if `|now - t| > 300`.
 *   3. Compute `hmacSha256(secret, t + "." + body)`, compare in
 *      constant time to `v1`.
 */

import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface SignedPayload {
  timestamp: number;
  signature: string;
  header: string;
}

/** Sign a raw JSON body string with the endpoint secret. */
export function signWebhookBody(secret: string, body: string): SignedPayload {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    timestamp,
    signature: signed,
    header: `t=${timestamp},v1=${signed}`,
  };
}

/** Verify an `X-AIPartner-Signature` header. Used by `/api/webhooks/test`. */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
): { ok: true } | { ok: false; reason: string } {
  if (!header) return { ok: false, reason: "missing-header" };
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=", 2);
      return [k.trim(), v?.trim() ?? ""];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) {
    return { ok: false, reason: "malformed" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > toleranceSeconds) {
    return { ok: false, reason: "stale-timestamp" };
  }
  const expected = createHmac("sha256", secret)
    .update(`${t}.${body}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad-signature" };
  }
  return { ok: true };
}

/** Generate a fresh 32-byte hex secret for a new endpoint. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}
