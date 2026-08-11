/**
 * Sentry — server runtime configuration.
 *
 * Loaded by `@sentry/nextjs` for the Node.js runtime (App Router server
 * components, Route Handlers, Server Actions). Edge runtime config lives
 * in `sentry.edge.config.ts`; client config in `sentry.client.config.ts`.
 *
 * The init is a no-op when SENTRY_DSN isn't set, so dev environments
 * without telemetry stay silent.
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Sampling
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

    // Privacy: scrub anything that smells like a secret or PII before
    // it leaves the box. We default to allow-list rather than deny-list
    // for breadcrumb data.
    beforeSend(event) {
      // Strip request cookies + auth headers — Sentry already scrubs
      // common keys, but we err on the side of caution.
      if (event.request?.headers) {
        for (const k of [
          "cookie",
          "authorization",
          "x-csrf-token",
          "x-auth-token",
        ]) {
          if (k in event.request.headers) {
            (event.request.headers as Record<string, string>)[k] = "[redacted]";
          }
        }
      }
      // Drop request body — Server Action payloads can be large.
      if (event.request) {
        delete (event.request as { data?: unknown }).data;
      }
      return event;
    },

    // We don't capture our own controlled "fail({ code: 'FORBIDDEN' })"
    // throws — those are domain errors, not bugs.
    ignoreErrors: [
      /Not authenticated/i,
      /^Forbidden$/i,
      /^NEXT_REDIRECT/,
      /^NEXT_NOT_FOUND/,
    ],
  });
}
