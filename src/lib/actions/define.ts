/**
 * `defineAction` — canonical Server Action wrapper.
 *
 * Every state-changing Server Action that customers, partners, admins,
 * or googlers can hit goes through this wrapper. It enforces:
 *
 *   1. **Input validation.** Zod schema parses raw input; failures
 *      return `INVALID_INPUT` with field-level issues.
 *   2. **Authentication.** Anonymous callers get `UNAUTHENTICATED`.
 *   3. **Authorisation.** RBAC matrix + condition fns; deny → `FORBIDDEN`.
 *   4. **Rate limiting.** Per-action key fn; over-limit → `RATE_LIMITED`.
 *   5. **Handler execution.** Wrapped in try/catch.
 *   6. **Output validation.** Optional Zod schema for the return value
 *      — guards downstream consumers against handler drift.
 *   7. **Audit log + error reporting.** Successful runs emit a
 *      `kind: action.<name>` event with redacted payload. INTERNAL and
 *      LLM_FAILURE errors are reported to Sentry via
 *      `@/lib/observability`; expected failures (FORBIDDEN, CONFLICT,
 *      INVALID_INPUT) are business outcomes and are not.
 *
 * Returning a discriminated `{ ok, data | error }` is deliberate — UI
 * code can pattern-match without try/catch and `<form action>` callers
 * get a serialisable response.
 *
 * For *public* actions (no auth), pass `permission: null` and provide
 * your own pre-checks inside the handler.
 */

import "server-only";
import { z } from "zod";
import { getActionContext } from "@/lib/action-context";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac/can";
import type { Permission } from "@/lib/rbac/permissions";
import type { ActionContext } from "@/lib/rbac/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import {
  ActionError,
  ActionFailure,
  ActionResult,
  fromZod,
  toActionError,
} from "@/lib/schemas/errors";

export interface RateLimitConfig<I> {
  /** Stable identifier suffix (the prefix is `user:<id>:` or `ip:<hash>:`). */
  scope: string;
  limit: number;
  windowSec: number;
  /** Optional override — by default we key on user id, falling back to ip hash. */
  key?: (parsed: I, ctx: ActionContext) => string | null;
}

export interface DefineActionOptions<I extends z.ZodTypeAny, O> {
  /** Stable identifier — surfaces in `AuditLog.kind` as `action.<name>`. */
  name: string;
  /** Zod schema for action input. */
  input: I;
  /** Optional Zod schema validating the handler's return value. */
  output?: z.ZodType<O>;
  /**
   * RBAC permission required to invoke. Pass `null` for explicitly public
   * actions (rare — only tokenised flows like partner T&C accept).
   */
  permission: Permission | null;
  /** Optional rate-limit config; omit for actions where it's not applicable. */
  rateLimit?: RateLimitConfig<z.infer<I>>;
  /**
   * Skip writing an audit log row on success. Default: emit. Use sparingly
   * — for very chatty actions like presence pings.
   */
  skipAudit?: boolean;
  /** The handler. Receives parsed input + the request context. */
  handler: (parsed: z.infer<I>, ctx: ActionContext) => Promise<O>;
}

export type ActionFn<I, O> = (raw: I) => Promise<ActionResult<O>>;

export function defineAction<I extends z.ZodTypeAny, O>(
  opts: DefineActionOptions<I, O>,
): ActionFn<unknown, O> {
  return async (raw: unknown): Promise<ActionResult<O>> => {
    const ctx = await getActionContext();

    // 1. Input
    const parsed = opts.input.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: fromZod(parsed.error) };
    }

    // 2. Auth
    if (opts.permission !== null && !ctx.user) {
      return { ok: false, error: { code: "UNAUTHENTICATED" } };
    }

    // 3. AuthZ
    if (opts.permission !== null) {
      const allowed = await can(
        ctx,
        opts.permission,
        parsed.data as Record<string, unknown>,
      );
      if (!allowed) {
        return {
          ok: false,
          error: { code: "FORBIDDEN", reason: opts.permission },
        };
      }
    }

    // 4. Rate limit
    if (opts.rateLimit) {
      const subject =
        opts.rateLimit.key?.(parsed.data, ctx) ??
        (ctx.user?.id
          ? `user:${ctx.user.id}`
          : ctx.ipHash
            ? `ip:${ctx.ipHash}`
            : null);
      if (subject) {
        const result = await checkRateLimit({
          key: `${subject}:${opts.rateLimit.scope}`,
          limit: opts.rateLimit.limit,
          windowSec: opts.rateLimit.windowSec,
        });
        if (result.limited) {
          return {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              retryAfterSec: result.retryAfterSec,
            },
          };
        }
      }
    }

    // 5. Handler + 6. Output validation + 7. Audit
    try {
      const data = await opts.handler(parsed.data, ctx);
      const validated = opts.output
        ? opts.output.parse(data)
        : data;

      if (!opts.skipAudit) {
        // Fire-and-forget audit; never blocks user response.
        void audit(ctx, {
          kind: `action.${opts.name}`,
          payload: parsed.data,
        });
      }

      return { ok: true, data: validated };
    } catch (err) {
      // ActionFailure thrown via `fail(...)` carries an explicit error.
      const error: ActionError =
        err instanceof ActionFailure
          ? err.error
          : toActionError(err, { traceId: ctx.traceId ?? undefined });

      // INTERNAL errors are reported; expected ones (FORBIDDEN, CONFLICT,
      // INVALID_INPUT…) are business outcomes, not faults, and would
      // drown the signal.
      //
      // This is guarantee #7 in the header, which claimed Sentry
      // reporting "once wired" and then only console.error'd. Server
      // Actions are where the business logic lives, so every failure in
      // the application was invisible in production while API-route and
      // rendering errors were captured.
      if (error.code === "INTERNAL" || error.code === "LLM_FAILURE") {
        captureError(err, {
          scope: "action",
          action: opts.name,
          userId: ctx.user?.id,
          companyId: ctx.user?.companyId ?? undefined,
          traceId: ctx.traceId ?? undefined,
          // Redacted by captureError; useful for reproducing.
          input: parsed.data,
        });
      }

      // Audit failures too — discoverability matters.
      if (!opts.skipAudit) {
        void audit(ctx, {
          kind: `action.${opts.name}.failed`,
          payload: { error: error.code, input: parsed.data },
        });
      }

      return { ok: false, error };
    }
  };
}

/** Re-export helpers commonly used alongside `defineAction`. */
export { fail } from "@/lib/schemas/errors";
