/**
 * Append-only audit log helper.
 *
 * Every state-changing Server Action is expected to emit one event via
 * `audit()`. The wrapper in `defineAction` calls this for you on success;
 * you only need to call it manually for actions outside the wrapper or
 * for intermediate sub-actions worth recording.
 *
 * **Performance discipline.** `audit()` is fire-and-forget: we never
 * block the user response on a successful audit insert. Failures are
 * logged to stderr (and Sentry, once wired) but never thrown.
 *
 * **Privacy discipline.** The `payload` we persist is a redacted copy of
 * the action input — secrets, raw IPs, and explicit PII are stripped.
 * Add new redaction rules to `redactPayload` as fields grow.
 */

import "server-only";
import { insertRow } from "@/lib/db";
import type { ActionContext } from "@/lib/rbac/types";

/** Maximum size of the JSON payload column we persist (≈ 16 KB). */
const MAX_PAYLOAD_BYTES = 16_384;

/** Field names we always strip from audit payloads. */
const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "secretCipher",
  "scimToken",
  "outreachToken",
  "inviteToken",
  "authorization",
  "cookie",
]);

function redactPayload(input: unknown): unknown {
  if (input == null) return input;
  if (Array.isArray(input)) return input.map(redactPayload);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k)) {
        out[k] = "[redacted]";
        continue;
      }
      // Heuristic: long base64-looking strings are probably tokens.
      if (
        typeof v === "string" &&
        v.length > 64 &&
        /^[A-Za-z0-9+/_-]+=*$/.test(v)
      ) {
        out[k] = "[redacted-tokenish]";
        continue;
      }
      out[k] = redactPayload(v);
    }
    return out;
  }
  return input;
}

function safeStringify(input: unknown): string {
  try {
    const json = JSON.stringify(redactPayload(input) ?? {});
    if (json.length <= MAX_PAYLOAD_BYTES) return json;
    return JSON.stringify({
      truncated: true,
      preview: json.slice(0, MAX_PAYLOAD_BYTES - 64) + "…",
    });
  } catch {
    return JSON.stringify({ error: "unserialisable-payload" });
  }
}

export interface AuditOptions {
  /** Stable identifier, e.g. "brief.update". */
  kind: string;
  /** Resource id this event targets (briefId, matchId, …). */
  targetId?: string | null;
  /** Free-form classification — use the table name. */
  targetType?: string | null;
  /** Extra context — input + diffs. Will be redacted + size-bounded. */
  payload?: unknown;
}

export async function audit(
  ctx: ActionContext,
  options: AuditOptions,
): Promise<void> {
  try {
    await insertRow(
      "AuditLog",
      {
        actorId: ctx.user?.id ?? null,
        kind: options.kind,
        targetId: options.targetId ?? null,
        targetType: options.targetType ?? null,
        companyId: ctx.user?.companyId ?? null,
        payload: safeStringify(options.payload ?? {}),
        requestId: ctx.requestId,
        traceId: ctx.traceId,
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
      },
      { noUpdatedAt: true },
    );
  } catch (err) {
    // Never let an audit failure surface to the user — log and move on.
    // eslint-disable-next-line no-console
    console.warn("[audit] failed to persist", options.kind, err);
  }
}

/** Fire-and-forget shorthand. */
export function auditAsync(
  ctx: ActionContext,
  options: AuditOptions,
): void {
  void audit(ctx, options);
}
