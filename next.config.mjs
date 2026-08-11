import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

/**
 * Hardened security headers, applied globally.
 *
 * - **HSTS** is only set in production — browsers cache it for a year, so
 *   accidentally setting it on `http://localhost` would lock devs out.
 * - **CSP** uses a permissive policy in dev (Next.js + Turbopack inject
 *   inline scripts/styles) and tightens in production. We move to a
 *   nonce-based CSP in the Phase 1 hardening pass.
 * - **Permissions-Policy** turns off browser features we don't use.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Next runtime ships some inline payloads; we'll move to nonce-only
            // in the Phase 1 hardening pass.
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint runs in CI / locally via `npm run lint`. Pre-existing stylistic
  // rules (e.g. @typescript-eslint/no-explicit-any) should not hard-fail the
  // production container build.
  eslint: { ignoreDuringBuilds: true },
  // Type-checking is enforced separately via `npm run typecheck` (tsc
  // --noEmit). Running it again inside `next build` is the most memory-heavy
  // phase and OOM-kills constrained build workers, so we skip it here.
  typescript: { ignoreBuildErrors: true },
  // Emits a self-contained build at .next/standalone/ — used by the Docker
  // image so the container only needs node + the minimum runtime files.
  output: "standalone",
  // @sentry/node ships auto-instrumentation for frameworks/ORMs we don't use
  // (Prisma, Fastify, …). Each one loads @opentelemetry/instrumentation, whose
  // dynamic `require` produced build warnings:
  //   "Critical dependency: the request of a dependency is an expression"
  // These packages are Node-only and must not be webpack-bundled anyway, so
  // marking them external fixes the warning at its source (rather than muting
  // it) and keeps them out of the server bundle.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "@opentelemetry/instrumentation",
    "@prisma/instrumentation",
    "@fastify/otel",
  ],
  // Pin the tracing root to this app so server.js lands at
  // .next/standalone/server.js (Next would otherwise walk up to a parent
  // lockfile and nest it under the absolute host path).
  outputFileTracingRoot: __dirname,
  // Accept Turbopack/dev assets served through browser-preview proxies and
  // LAN IPs so dev workflows (Windsurf preview, phone testing, etc.) don't
  // trip cross-origin protections.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.localhost",
    "192.168.1.207",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Allow Server Actions forwarded from the browser-preview proxy
      // (it uses 127.0.0.1:<random-port>) and local LAN addresses.
      // Next.js does not support port wildcards on allowedOrigins, so
      // we enumerate the ports the IDE preview tends to pick. If the
      // IDE assigns a port not listed here, open `http://localhost:3000`
      // directly instead of the proxied preview, or add the port below.
      allowedOrigins: [
        "localhost",
        "127.0.0.1",
        "localhost:3000",
        "127.0.0.1:3000",
        // Browser-preview proxy ports (IDE assigns a random port per
        // session). Add the current one here, or set PREVIEW_ORIGIN in
        // .env to the proxy host:port the IDE prints.
        ...(process.env.PREVIEW_ORIGIN ? [process.env.PREVIEW_ORIGIN] : []),
        "127.0.0.1:49910",
        "127.0.0.1:58054",
        "127.0.0.1:61165",
        "127.0.0.1:55000",
        "127.0.0.1:55555",
        "127.0.0.1:60000",
        "127.0.0.1:65000",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // security.txt benefits from a long cache + correct content-type.
        source: "/.well-known/security.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
