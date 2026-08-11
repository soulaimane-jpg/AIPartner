"use server";

/**
 * Passkey enrolment + revocation Server Actions.
 *
 * Three actions, all scoped to the authenticated user:
 *
 *   - `startPasskeyEnrolmentAction` — returns the WebAuthn
 *     creation options. Client passes them straight to
 *     `@simplewebauthn/browser`'s `startRegistration()`.
 *   - `verifyPasskeyEnrolmentAction` — verifies the attestation
 *     response and stores the new credential.
 *   - `deletePasskeyAction` — revokes a previously-registered key.
 *
 * The browser handoff (challenge ↔ response) lives in `passkeys.ts`;
 * this file is just the auth/permission boundary.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import {
  startPasskeyRegistration,
  verifyPasskeyRegistration,
  deletePasskey,
} from "@/lib/passkeys";

// ─── Start enrolment ─────────────────────────────────────────────

export const startPasskeyEnrolmentAction = defineAction({
  name: "account.passkey.start",
  input: z.object({}),
  // Output is a free-form WebAuthn options blob; we don't enforce a
  // strict schema because the browser API expects that exact shape.
  output: z.unknown(),
  permission: null,
  rateLimit: { scope: "account.passkey.start", limit: 10, windowSec: 60 },
  handler: async (_input, ctx) => {
    if (!ctx.user) fail({ code: "FORBIDDEN" });
    const options = await startPasskeyRegistration({
      id: ctx.user!.id,
      email: ctx.user!.email,
      name: ctx.user!.name ?? null,
    });
    return options;
  },
});

// ─── Verify enrolment ────────────────────────────────────────────

const VerifyEnrolmentInput = z.object({
  label: z.string().trim().min(2).max(80),
  response: z.unknown(),
});

export const verifyPasskeyEnrolmentAction = defineAction({
  name: "account.passkey.verify",
  input: VerifyEnrolmentInput,
  permission: null,
  rateLimit: { scope: "account.passkey.verify", limit: 10, windowSec: 60 },
  handler: async ({ label, response }, ctx) => {
    if (!ctx.user) fail({ code: "FORBIDDEN" });
    const result = await verifyPasskeyRegistration({
      userId: ctx.user!.id,
      label,
      // Cast — the browser-supplied shape varies; the lib validates.
      response: response as Parameters<typeof verifyPasskeyRegistration>[0]["response"],
    });
    if (!result.ok) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "response",
            message: `Passkey not verified: ${result.reason}`,
          },
        ],
      });
    }
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});

// ─── Delete passkey ──────────────────────────────────────────────

export const deletePasskeyAction = defineAction({
  name: "account.passkey.delete",
  input: z.object({ id: z.string().min(1) }),
  permission: null,
  rateLimit: { scope: "account.passkey.delete", limit: 10, windowSec: 60 },
  handler: async ({ id }, ctx) => {
    if (!ctx.user) fail({ code: "FORBIDDEN" });
    const ok = await deletePasskey({ userId: ctx.user!.id, id });
    if (!ok) fail({ code: "NOT_FOUND", resource: "Passkey" });
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});
