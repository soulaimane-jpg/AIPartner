"use client";

/**
 * Global error boundary — last line of defence.
 *
 * Next.js renders this when an error escapes both the route's `error.tsx`
 * and any nested boundaries. We capture to Sentry, present a calm UI,
 * and offer the user a way out (refresh + go home).
 *
 * Keep this file dependency-light — it can render even when the rest of
 * the app is broken.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
          color: "#0f172a",
        }}
      >
        <main
          style={{
            maxWidth: 480,
            padding: "32px 24px",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 12px 40px -8px rgba(15, 23, 42, 0.12)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "#fee2e2",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
            }}
            aria-hidden
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "#475569",
              fontSize: 14,
              margin: "0 0 24px",
              lineHeight: 1.55,
            }}
          >
            Our team has been notified and is looking into it. You can try
            again, or head back to safety.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#94a3b8",
                margin: "0 0 24px",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* Plain anchor on purpose: Next/Link relies on the router
                being healthy, which we can't guarantee from inside a
                global-error fallback. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-grid",
                placeItems: "center",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
