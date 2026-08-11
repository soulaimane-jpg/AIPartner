/**
 * Email provider seam.
 *
 * Production hardening §14.5 + plan Phase 0: every outbound email
 * flows through this single function. Swapping Resend ↔ Postmark ↔
 * AWS SES is a local change. Today we ship two providers:
 *
 *   - **mock**   (default in dev): persists the body to `Email` so
 *                team members can read what would have been sent.
 *   - **resend** (production): real HTTPS call to api.resend.com.
 *
 * The provider is selected at runtime by `EMAIL_PROVIDER` env var so
 * staging can run real Resend while dev stays mock. Failure modes are
 * isolated to this file; callers receive the same `EmailSendResult`
 * regardless of provider.
 *
 * Email records (`Email` table) are written *before* delivery so a
 * crash mid-call still leaves a trace; the row is then updated with
 * `status` after the provider call returns.
 */

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { insertRow, updateRows } from "@/lib/db";
import { env } from "@/env";

export interface SendEmailInput {
  toAddress: string;
  subject: string;
  body: string;
  /** "outreach" | "digest" | "dsr" | "magic-link" | "system" … */
  kind?: string;
  matchId?: string | null;
  briefId?: string | null;
  /** Provider-side reply-to override; defaults to the global. */
  replyTo?: string;
  /** Soft cap on body length — providers reject huge payloads. */
  maxBodyBytes?: number;
}

export type EmailSendResult =
  | { ok: true; id: string; providerId: string | null }
  | { ok: false; id: string | null; error: string };

const DEFAULT_REPLY_TO = "hello@aipartner.cloud";

function pickProvider(): "mock" | "resend" | "smtp" {
  const raw = env.EMAIL_PROVIDER?.toLowerCase();
  if (raw === "resend" && env.RESEND_API_KEY) return "resend";
  if (raw === "smtp" && env.SMTP_HOST) return "smtp";
  return "mock";
}

// ── SMTP transport (singleton, lazily constructed) ────────────────
//
// We cache the transporter on the module so nodemailer can keep the
// underlying TCP+TLS pool alive across `sendEmail` calls. Reset on env
// change isn't needed in practice (env is read once at boot).
let _smtpTransport: Transporter | null = null;
function getSmtpTransport(): Transporter {
  if (_smtpTransport) return _smtpTransport;
  const port = env.SMTP_PORT ?? 587;
  // Explicit override > port-based auto-detect (465 = implicit TLS).
  const secure =
    env.SMTP_SECURE === "true"
      ? true
      : env.SMTP_SECURE === "false"
        ? false
        : port === 465;
  _smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port,
    secure,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    // Reasonable defaults for transactional mail.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
  });
  return _smtpTransport;
}

async function deliverViaSMTP(
  input: SendEmailInput,
): Promise<{ providerId: string | null; raw: string | null }> {
  const transport = getSmtpTransport();
  const from = env.SMTP_FROM || env.EMAIL_FROM;
  const info = await transport.sendMail({
    from,
    to: input.toAddress,
    subject: input.subject,
    text: input.body,
    replyTo: input.replyTo ?? DEFAULT_REPLY_TO,
  });
  return { providerId: info.messageId ?? null, raw: info.response ?? null };
}

async function persistEmailRow(input: SendEmailInput, provider: string) {
  const body =
    input.maxBodyBytes && input.body.length > input.maxBodyBytes
      ? input.body.slice(0, input.maxBodyBytes - 32) + "\n…(truncated)"
      : input.body;
  return insertRow<{ id: string }>(
    "Email",
    {
      provider,
      toAddress: input.toAddress.toLowerCase(),
      subject: input.subject.slice(0, 240),
      body,
      status: "queued",
      matchId: input.matchId ?? null,
      briefId: input.briefId ?? null,
      kind: input.kind ?? "system",
    },
    { noUpdatedAt: true },
  );
}

async function deliverViaResend(
  input: SendEmailInput,
): Promise<{ providerId: string | null; raw: string | null }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM ?? "AI Partner <hello@aipartner.cloud>",
      to: [input.toAddress],
      subject: input.subject,
      text: input.body,
      reply_to: input.replyTo ?? DEFAULT_REPLY_TO,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${raw.slice(0, 240)}`);
  }
  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return { providerId: parsed.id ?? null, raw };
  } catch {
    return { providerId: null, raw };
  }
}

/** Single entry-point — every caller uses this. */
export async function sendEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  const provider = pickProvider();
  let row: { id: string } | null = null;
  try {
    row = await persistEmailRow(input, provider);
  } catch (err) {
    return {
      ok: false,
      id: null,
      error:
        err instanceof Error ? `persist failed: ${err.message}` : "persist failed",
    };
  }

  if (provider === "mock") {
    await updateRows(
      "Email",
      { id: row.id },
      { status: "sent", sentAt: new Date() },
      { noUpdatedAt: true },
    );
    // eslint-disable-next-line no-console
    console.log(
      `[MOCK EMAIL → ${input.toAddress}] (kind=${input.kind ?? "system"})\n${input.subject}\n${input.body}\n`,
    );
    return { ok: true, id: row.id, providerId: null };
  }

  try {
    const { providerId } =
      provider === "smtp"
        ? await deliverViaSMTP(input)
        : await deliverViaResend(input);
    await updateRows(
      "Email",
      { id: row.id },
      { status: "sent", sentAt: new Date(), providerId },
      { noUpdatedAt: true },
    );
    return { ok: true, id: row.id, providerId };
  } catch (err) {
    await updateRows(
      "Email",
      { id: row.id },
      {
        status: "failed",
        providerId: err instanceof Error ? err.message.slice(0, 200) : null,
      },
      { noUpdatedAt: true },
    );
    return {
      ok: false,
      id: row.id,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
