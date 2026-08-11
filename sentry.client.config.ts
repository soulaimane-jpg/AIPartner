/**
 * Sentry — browser runtime configuration. Loaded by `@sentry/nextjs`
 * for the client bundle. Session Replay is masked-by-default.
 */

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Replay: capture problems but don't be invasive about it.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    ignoreErrors: [
      // Common browser noise we don't care about
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /^NEXT_REDIRECT/,
      /^NEXT_NOT_FOUND/,
      // Network errors from ad blockers / VPNs
      /Failed to fetch/,
      /NetworkError when attempting to fetch resource/,
    ],
  });
}
