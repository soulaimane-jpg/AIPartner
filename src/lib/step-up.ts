/**
 * Step-up authentication — gate sensitive Server Actions on a fresh
 * MFA challenge.
 *
 * Usage inside a Server Action handler:
 *
 * ```ts
 * await requireStepUp({ windowSec: 5 * 60 });
 * // …proceed with sensitive work
 * ```
 *
 * Throws an `ActionFailure` with code `FORBIDDEN` if MFA hasn't been
 * verified within the window — the UI catches that and surfaces a
 * step-up prompt rather than a generic error toast.
 *
 * The MFA window default is 5 minutes — long enough that a user can
 * approve, click Continue, and reach the action handler in time;
 * short enough that a stolen tab can't replay forever.
 */

import "server-only";
import { cookies } from "next/headers";
import { fail } from "@/lib/schemas/errors";
import { isMfaFresh } from "@/lib/sessions";
import { getMfaStatus } from "@/lib/mfa";

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  for (const name of AUTH_COOKIE_NAMES) {
    const v = jar.get(name)?.value;
    if (v) return v;
  }
  return null;
}

export interface StepUpOptions {
  /**
   * How recently (in seconds) MFA must have been verified for this
   * session. Default: 5 minutes.
   */
  windowSec?: number;
  /**
   * If true, users without MFA enrolled are blocked. If false (default
   * during the soft-launch period), only enrolled users are gated —
   * unenrolled users pass through but are nudged to enrol. Flip on
   * once we mandate MFA for all roles.
   */
  requireEnrolled?: boolean;
  /**
   * For audit clarity — what action is being gated. Surfaces in the
   * `step-up.required` audit event.
   */
  forAction?: string;
  /**
   * For audit clarity — which user is being asked.
   */
  userId: string;
}

/**
 * Throws `FORBIDDEN` (with reason `STEP_UP_REQUIRED`) if the caller
 * needs to re-verify MFA. The UI maps that exact reason to a step-up
 * modal rather than a generic toast.
 */
export async function requireStepUp(opts: StepUpOptions): Promise<void> {
  const windowSec = opts.windowSec ?? 5 * 60;
  const token = await readSessionToken();
  if (!token) {
    fail({ code: "UNAUTHENTICATED" });
  }

  const status = await getMfaStatus(opts.userId);

  if (!status.enabled) {
    if (opts.requireEnrolled) {
      fail({
        code: "FORBIDDEN",
        reason: `STEP_UP_REQUIRED:enrol:${opts.forAction ?? "action"}`,
      });
    }
    // Soft-launch: pass through.
    return;
  }

  if (await isMfaFresh(token!, windowSec)) return;

  fail({
    code: "FORBIDDEN",
    reason: `STEP_UP_REQUIRED:verify:${opts.forAction ?? "action"}`,
  });
}
