/**
 * Single canonical error shape returned by every Server Action.
 *
 * Server Actions wrapped with `defineAction` always return either
 * `{ ok: true, data }` or `{ ok: false, error: ActionError }`. The error
 * shape is a discriminated union so callers can `switch (error.code)` and
 * get exhaustive type-narrowing for free.
 *
 * The `mapErrorToToast` helper turns any error into a user-facing copy
 * line; we keep the strings centralised so i18n can pick them up later.
 */

import { z } from "zod";

/** Field-level validation issues, surfaced from Zod errors. */
export const ActionIssue = z.object({
  path: z.string(),
  message: z.string(),
});
export type ActionIssue = z.infer<typeof ActionIssue>;

export const ActionError = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("INVALID_INPUT"),
    issues: z.array(ActionIssue),
    /** Human-readable summary; defaults populated by helpers. */
    message: z.string().optional(),
  }),
  z.object({ code: z.literal("UNAUTHENTICATED") }),
  z.object({
    code: z.literal("FORBIDDEN"),
    /** Internal reason for logs; never shown to user. */
    reason: z.string().optional(),
  }),
  z.object({
    code: z.literal("NOT_FOUND"),
    resource: z.string().optional(),
  }),
  z.object({
    code: z.literal("CONFLICT"),
    reason: z.string().optional(),
  }),
  z.object({
    code: z.literal("RATE_LIMITED"),
    retryAfterSec: z.number().int().nonnegative().optional(),
  }),
  z.object({
    code: z.literal("LLM_FAILURE"),
    retryable: z.boolean().default(true),
  }),
  z.object({
    code: z.literal("INTERNAL"),
    /** Sentry / OTel trace id, surfaceable to support reps but not end-users. */
    traceId: z.string().optional(),
  }),
]);
export type ActionError = z.infer<typeof ActionError>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

// ─── Helpers ──────────────────────────────────────────────────────

/** Wrap a Zod parse failure as an INVALID_INPUT ActionError. */
export function fromZod(err: z.ZodError): ActionError {
  const issues: ActionIssue[] = err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return {
    code: "INVALID_INPUT",
    issues,
    message: issues[0]?.message ?? "Some fields need attention.",
  };
}

/** Convert any thrown value to an ActionError, preferring known shapes. */
export function toActionError(
  err: unknown,
  ctx?: { traceId?: string },
): ActionError {
  if (err instanceof z.ZodError) return fromZod(err);
  // If a handler intentionally threw an ActionError, pass it through.
  const parsed = ActionError.safeParse(err);
  if (parsed.success) return parsed.data;

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error";
  // Map a small set of well-known message strings to typed errors.
  if (/not authenticated/i.test(message)) return { code: "UNAUTHENTICATED" };
  if (/forbidden|not your/i.test(message))
    return { code: "FORBIDDEN", reason: message };
  if (/not found/i.test(message))
    return { code: "NOT_FOUND", resource: undefined };
  if (/conflict|already exists/i.test(message))
    return { code: "CONFLICT", reason: message };

  return { code: "INTERNAL", traceId: ctx?.traceId };
}

/**
 * Map an ActionError to a single user-facing line.
 * Centralised so we can swap to i18n later without hunting call-sites.
 */
export function mapErrorToToast(err: ActionError): string {
  switch (err.code) {
    case "INVALID_INPUT":
      return err.message ?? err.issues[0]?.message ?? "Please check the form.";
    case "UNAUTHENTICATED":
      return "Please sign in to continue.";
    case "FORBIDDEN":
      return "You don't have permission to do that.";
    case "NOT_FOUND":
      return err.resource
        ? `${err.resource} not found.`
        : "We couldn't find that.";
    case "CONFLICT":
      return "That action conflicts with the current state.";
    case "RATE_LIMITED":
      return err.retryAfterSec
        ? `Too many requests. Try again in ${err.retryAfterSec}s.`
        : "Too many requests — slow down for a moment.";
    case "LLM_FAILURE":
      return "The AI assistant hit a snag. Please try again.";
    case "INTERNAL":
      return "Something went wrong. Our team has been notified.";
  }
}

/** Build an `INVALID_INPUT` error from a single message (manual cases). */
export function invalidInput(message: string, path = ""): ActionError {
  return {
    code: "INVALID_INPUT",
    issues: [{ path, message }],
    message,
  };
}

/** Throw an ActionError from inside a handler — caught by `defineAction`. */
export class ActionFailure extends Error {
  readonly error: ActionError;
  constructor(error: ActionError) {
    super(error.code);
    this.error = error;
  }
}

export function fail(error: ActionError): never {
  throw new ActionFailure(error);
}
