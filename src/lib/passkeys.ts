/**
 * WebAuthn / passkey helpers.
 *
 * Built on `@simplewebauthn/server` — a thin, audited wrapper around
 * the W3C Web Authentication APIs. We keep this library boundary tight
 * so we can swap implementations later without touching call sites.
 *
 * Two flows:
 *
 *   1. **Registration** — `startPasskeyRegistration(user)` returns the
 *      browser-side `PublicKeyCredentialCreationOptions`. The client
 *      calls `startRegistration()` from `@simplewebauthn/browser`,
 *      then POSTs the result back into `verifyPasskeyRegistration()`.
 *
 *   2. **Authentication** — `startPasskeyAuthentication(user)` issues
 *      a challenge. The client calls `startAuthentication()`, then
 *      POSTs back into `verifyPasskeyAuthentication()` which checks
 *      the assertion, bumps the signature counter, returns success.
 *
 * Challenges are persisted in `AuthPasskeyChallenge` so we can detect
 * replays even across distinct serverless invocations (each Vercel
 * function call is a different node).
 *
 * RP ID derivation: production = host of `NEXT_PUBLIC_APP_URL`;
 * dev = "localhost". The relying-party origin must match exactly,
 * otherwise the browser rejects the credential.
 */

import "server-only";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";
import type { AuthPasskeyRow } from "@/lib/db/rows";
import { env } from "@/env";

const RP_NAME = "AI Partner";

function rpId(): string {
  const url = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

function expectedOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** 5-minute challenge window. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function storeChallenge(opts: {
  userId: string;
  purpose: "registration" | "authentication";
  challenge: string;
}): Promise<void> {
  // Clear any previous challenge for the same (user, purpose).
  await exec(
    'DELETE FROM "AuthPasskeyChallenge" WHERE "userId" = $1 AND "purpose" = $2',
    [opts.userId, opts.purpose],
  );
  await insertRow("AuthPasskeyChallenge", {
    userId: opts.userId,
    purpose: opts.purpose,
    challenge: opts.challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

async function consumeChallenge(opts: {
  userId: string;
  purpose: "registration" | "authentication";
}): Promise<string | null> {
  const row = await queryOne<{ id: string; challenge: string }>(
    `SELECT "id", "challenge" FROM "AuthPasskeyChallenge"
     WHERE "userId" = $1 AND "purpose" = $2 AND "expiresAt" > NOW()
     ORDER BY "createdAt" DESC LIMIT 1`,
    [opts.userId, opts.purpose],
  );
  if (!row) return null;
  await exec('DELETE FROM "AuthPasskeyChallenge" WHERE "id" = $1', [row.id]);
  return row.challenge;
}

// ─── Registration ────────────────────────────────────────────────

export async function startPasskeyRegistration(user: {
  id: string;
  email: string;
  name: string | null;
}) {
  const existing = await query<{ credentialId: string }>(
    'SELECT "credentialId" FROM "AuthPasskey" WHERE "userId" = $1',
    [user.id],
  );

  const opts: GenerateRegistrationOptionsOpts = {
    rpName: RP_NAME,
    rpID: rpId(),
    userName: user.email,
    userDisplayName: user.name ?? user.email,
    userID: user.id,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: new Uint8Array(Buffer.from(c.credentialId, "base64url")),
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257],
  };

  const options = await generateRegistrationOptions(opts);
  await storeChallenge({
    userId: user.id,
    purpose: "registration",
    challenge: options.challenge,
  });
  return options;
}

export async function verifyPasskeyRegistration(opts: {
  userId: string;
  label: string;
  // The full attestation response from `@simplewebauthn/browser`.
  response: VerifyRegistrationResponseOpts["response"];
}): Promise<{ ok: true; credentialId: string } | { ok: false; reason: string }> {
  const expectedChallenge = await consumeChallenge({
    userId: opts.userId,
    purpose: "registration",
  });
  if (!expectedChallenge) {
    return { ok: false, reason: "challenge-expired" };
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: opts.response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      requireUserVerification: false,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "verification-failed",
    };
  }
  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, reason: "not-verified" };
  }
  const info = verification.registrationInfo;
  const credentialId = Buffer.from(info.credentialID).toString("base64url");
  await insertRow("AuthPasskey", {
    userId: opts.userId,
    label: opts.label.slice(0, 80),
    credentialId,
    publicKey: Buffer.from(info.credentialPublicKey).toString("base64url"),
    counter: BigInt(info.counter ?? 0).toString(),
    aaguid: info.aaguid ?? null,
  });
  return { ok: true, credentialId };
}

// ─── Authentication ──────────────────────────────────────────────

export async function startPasskeyAuthentication(user: { id: string }) {
  const keys = await query<{ credentialId: string }>(
    'SELECT "credentialId" FROM "AuthPasskey" WHERE "userId" = $1',
    [user.id],
  );
  if (keys.length === 0) {
    throw new Error("No passkeys registered for this user");
  }
  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    timeout: 60_000,
    userVerification: "preferred",
    allowCredentials: keys.map((k) => ({
      id: new Uint8Array(Buffer.from(k.credentialId, "base64url")),
      type: "public-key" as const,
      transports: ["internal", "usb", "ble", "nfc"] as AuthenticatorTransportFuture[],
    })),
  });
  await storeChallenge({
    userId: user.id,
    purpose: "authentication",
    challenge: options.challenge,
  });
  return options;
}

export async function verifyPasskeyAuthentication(opts: {
  userId: string;
  response: VerifyAuthenticationResponseOpts["response"];
}): Promise<{ ok: true; credentialId: string } | { ok: false; reason: string }> {
  const expectedChallenge = await consumeChallenge({
    userId: opts.userId,
    purpose: "authentication",
  });
  if (!expectedChallenge) {
    return { ok: false, reason: "challenge-expired" };
  }
  const credentialId = opts.response.id;
  const stored = await queryOne<AuthPasskeyRow>(
    'SELECT * FROM "AuthPasskey" WHERE "credentialId" = $1',
    [credentialId],
  );
  if (!stored || stored.userId !== opts.userId) {
    return { ok: false, reason: "unknown-credential" };
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: opts.response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      authenticator: {
        credentialID: new Uint8Array(Buffer.from(stored.credentialId, "base64url")),
        credentialPublicKey: new Uint8Array(
          Buffer.from(stored.publicKey, "base64url"),
        ),
        counter: Number(stored.counter),
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "verification-failed",
    };
  }
  if (!verification.verified) {
    return { ok: false, reason: "not-verified" };
  }
  await updateRows(
    "AuthPasskey",
    { id: stored.id },
    {
      counter: BigInt(verification.authenticationInfo.newCounter).toString(),
      lastUsedAt: new Date(),
    },
  );
  return { ok: true, credentialId: stored.credentialId };
}

// ─── Passkey list / revoke ──────────────────────────────────────

export async function listPasskeysForUser(userId: string) {
  return query<{
    id: string;
    label: string;
    aaguid: string | null;
    lastUsedAt: Date | null;
    createdAt: Date;
  }>(
    `SELECT "id", "label", "aaguid", "lastUsedAt", "createdAt"
     FROM "AuthPasskey" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [userId],
  );
}

export async function deletePasskey(opts: {
  userId: string;
  id: string;
}): Promise<boolean> {
  const affected = await exec(
    'DELETE FROM "AuthPasskey" WHERE "id" = $1 AND "userId" = $2',
    [opts.id, opts.userId],
  );
  return affected > 0;
}
