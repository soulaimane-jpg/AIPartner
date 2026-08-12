/**
 * Partner verification — the vetting gate behind the platform's core
 * promise ("vetted Google Cloud partners").
 *
 * A partner company is created `PENDING` and cannot be sourced or
 * invited until an admin approves it. Domain evidence is *recorded,
 * never trusted*: matching the signup email domain against the
 * partner's own website is a useful signal for the reviewer, but it
 * is self-asserted data, so a human decision is always required.
 */

import "server-only";

export const VERIFICATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Free-mail domains that can never evidence a company identity. */
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "qq.com",
]);

/** Lower-cased domain part of an email address, or null. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/** Registrable-ish host for a URL: lower-cased, `www.` stripped. */
export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isGenericEmailDomain(domain: string | null): boolean {
  return domain != null && GENERIC_EMAIL_DOMAINS.has(domain);
}

/**
 * Do an email domain and a website host plausibly belong to the same
 * organisation? Accepts exact matches and subdomains in either
 * direction (`mail.cloudco.com` ↔ `cloudco.com`).
 */
export function domainsMatch(
  domain: string | null,
  host: string | null,
): boolean {
  if (!domain || !host) return false;
  if (isGenericEmailDomain(domain)) return false;
  if (domain === host) return true;
  return domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
}

export interface DomainEvidence {
  domain: string | null;
  matched: boolean;
  /** Why the reviewer should or shouldn't weigh this evidence. */
  reason:
    | "matches_website"
    | "generic_email_domain"
    | "no_website_on_file"
    | "no_match";
}

/**
 * Evidence shown to the admin reviewing a pending partner. Never
 * approves on its own.
 */
export function assessDomainEvidence(opts: {
  email: string;
  website?: string | null;
  directoryUrl?: string | null;
}): DomainEvidence {
  const domain = emailDomain(opts.email);
  if (isGenericEmailDomain(domain)) {
    return { domain, matched: false, reason: "generic_email_domain" };
  }
  const hosts = [hostFromUrl(opts.website), hostFromUrl(opts.directoryUrl)].filter(
    (h): h is string => h != null,
  );
  if (hosts.length === 0) {
    return { domain, matched: false, reason: "no_website_on_file" };
  }
  const matched = hosts.some((h) => domainsMatch(domain, h));
  return {
    domain,
    matched,
    reason: matched ? "matches_website" : "no_match",
  };
}
