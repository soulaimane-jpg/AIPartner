/**
 * GDPR-grade cookie consent.
 *
 * Three concerns lives here:
 *
 *   1. **Versioning.** `POLICY_VERSION` is bumped whenever the cookie
 *      disclosure changes. The browser cookie carries the version too;
 *      a mismatch invalidates the consent and re-shows the banner.
 *
 *   2. **Server-side ledger.** Every accept / reject / customise event
 *      is appended to `CookieConsent` for audit. We record the cookieId
 *      (anonymous), the chosen categories, and the policy version.
 *
 *   3. **Read helpers.** Server components call `readConsent()` to
 *      decide whether to inject analytics scripts. The check is
 *      synchronous on the cookie value alone — no DB hit.
 *
 * Categories:
 *   - `necessary`  — always true (auth, CSRF, language).
 *   - `analytics`  — product usage telemetry (PostHog, Plausible).
 *   - `marketing`  — ad/retargeting pixels (off by default).
 */

import "server-only";
import { cookies } from "next/headers";

export const COOKIE_NAME = "aip_consent";
export const POLICY_VERSION = "2026-05-01";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** Banner version when the user made the choice. */
  version: string;
  /** Opaque id we use to link DB ledger rows to the cookie. */
  cookieId: string;
}

const DEFAULT_STATE: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: POLICY_VERSION,
  cookieId: "",
};

/**
 * Read the consent cookie. Returns `null` if the visitor hasn't
 * decided yet (banner should show) or the policy version is stale.
 */
export async function readConsent(): Promise<ConsentState | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (!parsed.version || parsed.version !== POLICY_VERSION) return null;
    return {
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      version: POLICY_VERSION,
      cookieId: typeof parsed.cookieId === "string" ? parsed.cookieId : "",
    };
  } catch {
    return null;
  }
}

/** Convenience predicate for layout-level analytics injection. */
export async function isAnalyticsAllowed(): Promise<boolean> {
  const c = await readConsent();
  return !!c?.analytics;
}

/** Default state factory exposed for the banner UI. */
export function defaultConsent(): ConsentState {
  return { ...DEFAULT_STATE, cookieId: newCookieId() };
}

export function newCookieId(): string {
  const a = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
