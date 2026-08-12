/**
 * Email templates rendered to plain text for demo / mock-email flows.
 * Today these strings are stored on records (e.g. `Match.mockEmailBody`,
 * `Lead.mockEmailBody`) so the UI can show "what we would have sent".
 *
 * When we plug in a real transactional provider (Postmark, Resend, SES),
 * `sendOutreachEmail` (see `@/lib/email/outreach`) becomes the single
 * seam to swap.
 *
 * This module is pure/client-safe — it must NOT import the DB layer, so
 * client components can reuse the template constants + `renderTemplate`.
 */

export type PartnerOutreachVars = {
  partnerName: string;
  partnerCompany: string;
  recipientEmail: string;
  customerIndustry: string;
  customerRegion: string;
  briefSummary: string;
  briefTitle: string;
  acceptUrl: string;
};

export const DEFAULT_PARTNER_OUTREACH_SUBJECT =
  "New Google Cloud opportunity — {{customerIndustry}} ({{customerRegion}})";

export const DEFAULT_PARTNER_OUTREACH_BODY = `Hi {{partnerName}},

The AI Partner team identified {{partnerCompany}} as a strong fit for a new
Google Cloud opportunity we're sourcing.

Customer (anonymised):
  Industry  : {{customerIndustry}}
  Region    : {{customerRegion}}
  Project   : {{briefTitle}}

Summary
─────────────────────────────────────────────────────────────
{{briefSummary}}
─────────────────────────────────────────────────────────────

If you'd like to be considered, please review and accept our standard
terms of conditions for this lead — it takes about 60 seconds:

  {{acceptUrl}}

You can forward the link to the right colleague (e.g. your sales VP) from
the same page if you're not the right approver.

— AI Partner
`;

/** Replace {{var}} placeholders in a template string. */
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`,
  );
}

export function renderPartnerOutreach(vars: PartnerOutreachVars): {
  subject: string;
  body: string;
} {
  const flat: Record<string, string> = { ...vars };
  return {
    subject: renderTemplate(DEFAULT_PARTNER_OUTREACH_SUBJECT, flat),
    body: renderTemplate(DEFAULT_PARTNER_OUTREACH_BODY, flat),
  };
}

// ── Brief collaborator invite ─────────────────────────────────────

export type CollaboratorInviteVars = {
  inviterName: string;
  briefTitle: string;
  /** "VIEWER" | "EDITOR" — printed verbatim. */
  role: string;
  acceptUrl: string;
};

/**
 * Plain-text invite email sent to a brief collaborator. Subject calls
 * out the project so it survives a busy inbox; body is short and
 * leads with the accept link.
 */
export function renderCollaboratorInviteEmail(vars: CollaboratorInviteVars): {
  subject: string;
  body: string;
} {
  const subject = `${vars.inviterName} invited you to collaborate on "${vars.briefTitle}"`;
  const action =
    vars.role === "EDITOR"
      ? "review and edit the Statement of Work"
      : "view the Statement of Work";
  const body = `Hi,

${vars.inviterName} invited you to ${action} for the project brief
"${vars.briefTitle}" on AI Partner.

You'll be added as ${vars.role.toLowerCase()}. Accept the invite here:

  ${vars.acceptUrl}

You'll only have access to this specific project — no other briefs or
data on the account are shared. Signing up takes about a minute.

If you didn't expect this invite you can safely ignore the email.

— AI Partner
`;
  return { subject, body };
}

// ── Password reset ────────────────────────────────────────────────

export type PasswordResetVars = {
  /** Display name when we have one, otherwise the email local part. */
  recipientName: string;
  resetUrl: string;
  /** How long the link stays valid, e.g. "60 minutes". */
  expiresIn: string;
};

/**
 * Plain-text password reset email. Deliberately does not confirm whether
 * an account exists — the caller only sends this when it does, and the
 * request endpoint always reports success to avoid account enumeration.
 */
export function renderPasswordResetEmail(vars: PasswordResetVars): {
  subject: string;
  body: string;
} {
  const subject = "Reset your AI Partner password";
  const body = `Hi ${vars.recipientName},

We received a request to reset the password for your AI Partner account.

Choose a new password here:

  ${vars.resetUrl}

This link expires in ${vars.expiresIn} and can only be used once.

If you didn't request a password reset you can safely ignore this email —
your current password will keep working and nothing has changed.

— AI Partner
`;
  return { subject, body };
}

// ── Email verification ────────────────────────────────────────────

export type EmailVerificationVars = {
  /** Display name when we have one, otherwise the email local part. */
  recipientName: string;
  verificationUrl: string;
  /** How long the link stays valid, e.g. "48 hours". */
  expiresIn: string;
};

/**
 * Plain-text email-confirmation message sent on credentials signup.
 * Confirming ownership is what stops someone registering as
 * `someone@bigcorp.com` and receiving that company's briefs.
 */
export function renderEmailVerificationEmail(vars: EmailVerificationVars): {
  subject: string;
  body: string;
} {
  const subject = "Confirm your email for AI Partner";
  const body = `Hi ${vars.recipientName},

Please confirm this email address so we know it belongs to you:

  ${vars.verificationUrl}

This link expires in ${vars.expiresIn} and can only be used once.

If you didn't create an AI Partner account you can safely ignore this
email — the account stays unconfirmed and no data is shared with it.

— AI Partner
`;
  return { subject, body };
}

// `sendOutreachEmail` moved to `@/lib/email/outreach` (server-only) so
// this module stays client-safe.
