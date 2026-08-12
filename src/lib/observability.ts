import "server-only";

import * as Sentry from "@sentry/nextjs";

/**
 * Single error-reporting entry point for server-side code.
 *
 * Sentry was initialised (`instrumentation.ts`, `global-error.tsx`) but
 * nothing in the business layer used it: `defineAction` only
 * `console.error`'d and `notify()` swallowed four distinct failure
 * classes. Since Server Actions are where the business logic lives,
 * every action failure and every dropped notification was invisible in
 * production.
 *
 * Reporting must never throw — an observability problem must not become
 * an application problem.
 */

/** Keys whose values must never reach the error tracker. */
const SENSITIVE_KEYS =
  /pass(word)?|secret|token|otp|mfa|authorization|cookie|apikey|api_key|creditcard|iban/i;

/** Redact obviously sensitive fields before attaching context. */
export function redactContext(
  input: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 3) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "[redacted]";
    } else if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 20);
    } else if (value && typeof value === "object") {
      out[key] = redactContext(value as Record<string, unknown>, depth + 1);
    } else if (typeof value === "string") {
      out[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export interface ErrorContext {
  /** Coarse grouping, e.g. "action", "notify", "job". */
  scope?: string;
  /** Actor, for correlating without storing PII beyond ids. */
  userId?: string;
  companyId?: string;
  [key: string]: unknown;
}

export function captureError(err: unknown, context: ErrorContext = {}): void {
  const { scope = "server", userId, companyId, ...rest } = context;
  try {
    Sentry.withScope((s) => {
      s.setTag("scope", scope);
      if (userId) s.setUser({ id: userId });
      if (companyId) s.setTag("companyId", companyId);
      const extra = redactContext(rest);
      for (const [key, value] of Object.entries(extra)) {
        s.setExtra(key, value);
      }
      s.captureException(err instanceof Error ? err : new Error(String(err)));
    });
  } catch {
    // Sentry unavailable (not configured in dev/test) — fall through.
  }
  // Always keep a local trace: Cloud Run logs are the fallback when
  // Sentry is unconfigured, and they're what `gcloud logging read` sees.
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, err instanceof Error ? err.message : err, rest);
}

/** Non-error signal worth counting (e.g. a firewall redaction). */
export function captureWarning(
  message: string,
  context: ErrorContext = {},
): void {
  const { scope = "server", ...rest } = context;
  try {
    Sentry.withScope((s) => {
      s.setTag("scope", scope);
      const extra = redactContext(rest);
      for (const [key, value] of Object.entries(extra)) {
        s.setExtra(key, value);
      }
      s.captureMessage(message, "warning");
    });
  } catch {
    // ignore
  }
  // eslint-disable-next-line no-console
  console.warn(`[${scope}] ${message}`, rest);
}
