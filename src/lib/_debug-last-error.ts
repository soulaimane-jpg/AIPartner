/**
 * TEMPORARY in-memory capture of the last Claude chat error.
 *
 * Used only by `/api/_debug/last-chat-error` to surface the real
 * server-side stack to the browser while diagnosing why
 * `/api/chat` returns the friendly "I hit a connection issue"
 * fallback. Delete this file (and the route + import) once the
 * underlying bug is identified.
 */

type Captured = {
  ts: string;
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
  raw?: string;
};

let lastError: Captured | null = null;

export function recordChatError(err: unknown) {
  try {
    const e = err as Error & { status?: number; cause?: unknown };
    lastError = {
      ts: new Date().toISOString(),
      name: e?.name ?? "Error",
      message: e?.message ?? String(err),
      stack: e?.stack,
      cause: e?.cause,
      raw: safeJson(err),
    };
  } catch {
    lastError = {
      ts: new Date().toISOString(),
      name: "UnserialisableError",
      message: String(err),
    };
  }
}

export function readLastChatError(): Captured | null {
  return lastError;
}

function safeJson(v: unknown): string | undefined {
  try {
    return JSON.stringify(
      v,
      (_k, val) => (val instanceof Error ? { name: val.name, message: val.message, stack: val.stack } : val),
      2,
    );
  } catch {
    return undefined;
  }
}
