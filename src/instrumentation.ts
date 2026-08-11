/**
 * Next.js 15 instrumentation hook.
 *
 * Loaded once per runtime (Node and Edge each call it). We use it to
 * boot Sentry — Next now prefers `instrumentation.ts` over the legacy
 * `sentry.{server,edge}.config.ts` auto-loading.
 *
 * Keep this file dependency-light: it runs before any user code and a
 * heavy import slows every cold-start.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

type RequestErrorRequest = Parameters<
  typeof import("@sentry/nextjs").captureRequestError
>[1];

export async function onRequestError(
  err: unknown,
  request: RequestErrorRequest,
  context: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >[2],
) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
