"use server";

/**
 * Server Actions for MFA + session management.
 *
 * All wrapped in `defineAction` so each invocation is audit-logged,
 * permission-checked, rate-limited, and returns a structured error.
 *
 * **Why these are separate from `actions/auth.ts`**: `auth.ts` covers
 * sign-in / sign-up flows; this file is exclusively the post-login
 * security surface (enrol MFA, list sessions, revoke a device, etc.).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import QRCode from "qrcode";
import { defineAction, fail } from "@/lib/actions/define";
import {
  generateMfaEnrolment,
  enableMfa,
  disableMfa,
  verifyTotp,
  getMfaStatus,
} from "@/lib/mfa";
import {
  listActiveSessions,
  revokeSession,
  revokeAllSessions,
  markMfaVerified,
} from "@/lib/sessions";
import { queryOne } from "@/lib/db";

// ─── MFA enrolment / management ──────────────────────────────────

const StartMfaInput = z.object({});

export const startMfaEnrolmentAction = defineAction({
  name: "auth.mfa.start",
  input: StartMfaInput,
  output: z.object({
    secret: z.string(),
    otpauthUrl: z.string(),
    qrcodeDataUrl: z.string(),
    recoveryCodes: z.array(z.string()),
  }),
  permission: "auth.mfa.configure",
  rateLimit: { scope: "auth.mfa.start", limit: 5, windowSec: 600 },
  handler: async (_input, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const enrolment = await generateMfaEnrolment({
      id: ctx.user!.id,
      email: ctx.user!.email,
    });
    const qrcodeDataUrl = await QRCode.toDataURL(enrolment.otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });
    return {
      secret: enrolment.secret,
      otpauthUrl: enrolment.otpauthUrl,
      qrcodeDataUrl,
      recoveryCodes: enrolment.recoveryCodes,
    };
  },
});

const ConfirmMfaInput = z.object({
  code: z.string().trim().min(4).max(20),
});

export const confirmMfaEnrolmentAction = defineAction({
  name: "auth.mfa.confirm",
  input: ConfirmMfaInput,
  permission: "auth.mfa.configure",
  rateLimit: { scope: "auth.mfa.confirm", limit: 10, windowSec: 300 },
  handler: async ({ code }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const ok = await enableMfa(ctx.user!.id, code);
    if (!ok) fail({ code: "INVALID_INPUT", issues: [{ path: "code", message: "Code didn't match. Try again." }] });
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});

const DisableMfaInput = z.object({
  /** Caller must re-prove possession before we tear down MFA. */
  code: z.string().trim().min(4).max(20),
});

export const disableMfaAction = defineAction({
  name: "auth.mfa.disable",
  input: DisableMfaInput,
  permission: "auth.mfa.configure",
  rateLimit: { scope: "auth.mfa.disable", limit: 5, windowSec: 600 },
  handler: async ({ code }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const ok = await verifyTotp(ctx.user!.id, code);
    if (!ok) fail({ code: "FORBIDDEN", reason: "MFA verification failed" });
    await disableMfa(ctx.user!.id);
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});

/**
 * Verify a TOTP code and mark *the current session* as MFA-fresh.
 * Used during step-up flows for sensitive actions.
 *
 * The session token is required since `defineAction` doesn't have it
 * (it's a cookie, not part of the action input). The caller looks it
 * up via `cookies()` and passes it in as `sessionToken`.
 */
const VerifyForStepUpInput = z.object({
  code: z.string().trim().min(4).max(20),
  sessionToken: z.string().min(8),
});

export const verifyMfaForStepUpAction = defineAction({
  name: "auth.mfa.stepup",
  input: VerifyForStepUpInput,
  permission: "auth.mfa.configure",
  rateLimit: { scope: "auth.mfa.stepup", limit: 10, windowSec: 60 },
  handler: async ({ code, sessionToken }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const ok = await verifyTotp(ctx.user!.id, code);
    if (!ok) fail({ code: "FORBIDDEN", reason: "MFA code rejected" });
    await markMfaVerified(sessionToken);
    return { ok: true as const };
  },
});

// ─── Session management ────────────────────────────────────────

const RevokeSessionInput = z.object({
  sessionId: z.string().min(8),
});

export const revokeSessionAction = defineAction({
  name: "auth.session.revoke",
  input: RevokeSessionInput,
  permission: "auth.session.revoke",
  rateLimit: { scope: "auth.session.revoke", limit: 30, windowSec: 60 },
  handler: async ({ sessionId }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const ok = await revokeSession({
      userId: ctx.user!.id,
      sessionId,
    });
    if (!ok) fail({ code: "NOT_FOUND", resource: "Session" });
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});

const RevokeAllInput = z.object({
  /** Optional — keep one session active (usually the current one). */
  exceptSessionId: z.string().min(8).optional(),
});

export const revokeAllSessionsAction = defineAction({
  name: "auth.session.revoke-all",
  input: RevokeAllInput,
  permission: "auth.session.revoke",
  rateLimit: { scope: "auth.session.revoke-all", limit: 5, windowSec: 600 },
  handler: async ({ exceptSessionId }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const count = await revokeAllSessions({
      userId: ctx.user!.id,
      exceptSessionId,
    });
    revalidatePath("/account/security");
    return { revoked: count };
  },
});

// ─── Read helpers (server components call these directly) ──────

export async function getCurrentUserSecurityState(userId: string) {
  const [mfa, sessions, user] = await Promise.all([
    getMfaStatus(userId),
    listActiveSessions(userId),
    queryOne<{ id: string; email: string; name: string | null; role: string }>(
      'SELECT "id", "email", "name", "role" FROM "User" WHERE "id" = $1',
      [userId],
    ),
  ]);
  return { mfa, sessions, user };
}
