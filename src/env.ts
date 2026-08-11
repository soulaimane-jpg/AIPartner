/**
 * Boot-time environment validation.
 *
 * Every `process.env.*` read in app code should go through `env` from this
 * module. We fail fast on boot if any required variable is missing or
 * malformed — far better than discovering at runtime that a required key
 * was never set.
 *
 * This module is safe to import from both server and client code; client
 * code only sees keys prefixed with `NEXT_PUBLIC_`.
 */

import { z } from "zod";

/**
 * Optional secret: treats an empty string the same as "unset" so a
 * commented-out / placeholder line like `OPENAI_API_KEY=""` in `.env`
 * doesn't fail `min()` validation and crash the whole env parse.
 */
const optionalSecret = (min = 1) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(min).optional(),
  );

/**
 * Email-ish string: accepts plain RFC emails ("a@b.com") AND the common
 * display-name form ("AI Partner <noreply@ai-partner.local>") used in
 * From: headers. Falls back to undefined on empty string.
 */
const emailLike = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .refine(
      (s) => /^[^<>]*<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>$/.test(s) || /^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/.test(s),
      { message: "Must be an email address or 'Name <email@domain>' form" },
    )
    .optional(),
);

// ─── Server-only env (never sent to the browser) ───────────────────────
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database — both required in production, optional locally so devs can
  // bring their own (and CI can typecheck/build without a live DB).
  DATABASE_URL: z
    .string()
    .url({ message: "DATABASE_URL must be a valid PostgreSQL connection URL" })
    .optional(),
  // Optional direct (non-pooled) connection string. Unused at runtime;
  // kept optional so any stray reference still type-checks.
  DIRECT_URL: z.string().url().optional(),

  // Auth — required in production.
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_TRUST_HOST: z
    .enum(["true", "false"])
    .optional()
    .default("true"),

  // AI providers — optional. Anthropic preferred; OpenAI legacy.
  ANTHROPIC_API_KEY: optionalSecret(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-5"),
  OPENAI_API_KEY: optionalSecret(),

  // Google OAuth — optional in dev, required in prod if "Continue with Google"
  // should work. Auth.js auto-detects AUTH_GOOGLE_* env var names.
  AUTH_GOOGLE_ID: optionalSecret(),
  AUTH_GOOGLE_SECRET: optionalSecret(),

  // Google Calendar OAuth Web client — used by admins to schedule
  // meetings between customers + partners. Separate from AUTH_GOOGLE_*
  // because the OAuth consent screen for Calendar requires the
  // calendar.events scope which we don't want on the sign-in path.
  GOOGLE_CALENDAR_CLIENT_ID: optionalSecret(),
  GOOGLE_CALENDAR_CLIENT_SECRET: optionalSecret(),

  // Email provider. Defaults to "mock" (writes to Email table but
  // doesn't actually send). Flip to "smtp" for real delivery via any
  // SMTP server (Gmail, Mailgun, SES, SendGrid, custom relay).
  EMAIL_PROVIDER: z
    .enum(["mock", "resend", "postmark", "smtp"])
    .default("mock"),
  EMAIL_FROM: emailLike.default("AI Partner <noreply@ai-partner.local>"),
  RESEND_API_KEY: optionalSecret(),
  /** Optional Resend From header override (defaults to EMAIL_FROM). */
  RESEND_FROM: optionalSecret(),
  POSTMARK_SERVER_TOKEN: optionalSecret(),

  // ── SMTP (used when EMAIL_PROVIDER=smtp) ─────────────────────────
  /** SMTP server hostname, e.g. smtp.gmail.com / smtp.mailgun.org. */
  SMTP_HOST: optionalSecret(),
  /** SMTP port: 465 (SSL), 587 (STARTTLS, default), 25 (on-prem). */
  SMTP_PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.coerce.number().int().min(1).max(65535).optional(),
    )
    .default(587),
  SMTP_USER: optionalSecret(),
  SMTP_PASS: optionalSecret(),
  /** Auto-detected from port (465 → true) when unset. */
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  /** From header override for the SMTP path (defaults to EMAIL_FROM). */
  SMTP_FROM: emailLike,

  /** Secret token Vercel Cron (or any scheduler) must present to call
   *  `/api/cron/*` routes. Optional in dev (localhost is trusted). */
  CRON_SECRET: optionalSecret(16),

  // Observability — optional today, hard-required in production once wired.
  SENTRY_DSN: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  POSTHOG_API_KEY: optionalSecret(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),

  // Crypto / secrets
  /// 32-byte hex string used as a HMAC key for IP hashing in audit logs.
  /// Generated once and never logged. Falls back to AUTH_SECRET in dev.
  AUDIT_HMAC_KEY: optionalSecret(32),

  // Object storage for brief attachments (Google Cloud Storage).
  /// Private bucket holding uploaded brief files. When unset, uploads are
  /// rejected with a clear error rather than silently losing the file.
  GCS_BUCKET: z.string().min(3).optional(),
  /// Optional explicit project id. On Cloud Run the metadata server supplies
  /// this, so it's only needed for local development.
  GCS_PROJECT_ID: z.string().min(3).optional(),

  // Rate limit backend — DB by default; flip to "redis" once Upstash wired.
  RATE_LIMIT_BACKEND: z.enum(["db", "redis", "memory"]).default("db"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

// ─── Public env (sent to the browser; must be NEXT_PUBLIC_*) ─────────
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z
    .string()
    .url()
    .optional()
    .default("https://eu.i.posthog.com"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

// In production, certain keys are required. We escalate optional → required.
function applyProductionRequirements<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  rawNodeEnv: string | undefined,
): T {
  if (rawNodeEnv !== "production") return schema;
  // Use parse(...) on a stricter inline schema in production.
  return schema as T;
}

// We pass the full shape so misconfigurations surface as a single, readable
// stack trace at boot rather than as scattered runtime null-derefs.
const merged = serverSchema.merge(clientSchema);
type Env = z.infer<typeof merged>;

const _parsed = merged.safeParse(process.env);

if (!_parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment configuration:\n",
    _parsed.error.flatten().fieldErrors,
  );
  // In production we hard-fail; in dev we log and continue with parsed
  // defaults so `next dev` still boots and you can fix iteratively.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment configuration. See logs above.");
  }
}

const _env = (_parsed.success ? _parsed.data : ({} as Env)) as Env;

// Production-required escalation. We do this *after* parsing so dev can run
// without the strictness, while production refuses to boot without these.
if (_env.NODE_ENV === "production") {
  const requiredInProd: (keyof Env)[] = [
    "DATABASE_URL",
    "AUTH_SECRET",
  ];
  const missing = requiredInProd.filter((k) => !_env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required production env: ${missing.join(", ")}`,
    );
  }
}

applyProductionRequirements(merged, _env.NODE_ENV);

export const env: Readonly<Env> = Object.freeze(_env);

// Convenience flags
export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
