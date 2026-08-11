/**
 * Declared account type carried across the Google OAuth round-trip.
 *
 * Auth.js v5 hands the `signIn` callback only `{ user, account, profile }` — it
 * has no access to the `callbackUrl`, so the intent cannot ride along in
 * `next`. A short-lived httpOnly cookie is set immediately before the redirect
 * to Google and read once when the callback creates the account.
 *
 * Only `partner` is ever written. `customer` is the default and needs no
 * signal, which keeps the cookie incapable of granting anything privileged —
 * `ADMIN` and `GOOGLER` are not expressible here.
 */
export const SIGNUP_INTENT_COOKIE = "ap_signup_intent";

/** Ten minutes: long enough for a slow Google consent screen, short enough
 *  that a stale value can't affect an unrelated later sign-up. */
export const SIGNUP_INTENT_MAX_AGE = 60 * 10;

/**
 * Consumer mailbox providers. A partner on one of these gives us no usable
 * company name, so `companyNameFromEmail` returns null and the caller asks
 * instead of inventing "Gmail" as a company.
 *
 * Matched on the brand label rather than the full domain so regional variants
 * (`yahoo.co.uk`, `hotmail.fr`) are covered by one entry.
 */
const CONSUMER_MAIL_BRANDS = new Set([
  "gmail",
  "googlemail",
  "yahoo",
  "ymail",
  "rocketmail",
  "hotmail",
  "outlook",
  "live",
  "msn",
  "passport",
  "aol",
  "icloud",
  "me",
  "mac",
  "proton",
  "protonmail",
  "pm",
  "gmx",
  "mail",
  "email",
  "yandex",
  "zoho",
  "fastmail",
  "hey",
  "tutanota",
  "tuta",
  "duck",
  "qq",
  "163",
  "126",
  "sina",
  "naver",
  "daum",
  "hanmail",
  "web",
  "t-online",
  "orange",
  "free",
  "wanadoo",
  "libero",
  "seznam",
  "rediffmail",
  "comcast",
  "verizon",
  "att",
  "sbcglobal",
  "bellsouth",
  "cox",
  "btinternet",
  "sky",
  "virginmedia",
]);

/**
 * Second-level labels that behave as public suffixes when followed by a
 * two-letter country code — `acme.co.uk`, `acme.com.au`. Without this the
 * brand would come out as "Co".
 */
const SECOND_LEVEL_SUFFIXES = new Set([
  "co",
  "com",
  "net",
  "org",
  "gov",
  "edu",
  "ac",
  "or",
  "ne",
  "go",
]);

/** Words that should stay upper-case when they form the whole brand. */
const ACRONYM_BRANDS = new Set(["ibm", "sap", "aws", "gcp", "bt", "kpn", "ovh"]);

/**
 * Extract the registrable brand label from an email address.
 *
 * Returns null for consumer mailboxes and anything unparseable.
 */
export function brandLabelFromEmail(email: string): string | null {
  // Exactly one "@", with something on both sides. Anything else is not an
  // address, and guessing a company from it would be worse than declining.
  const segments = email.trim().split("@");
  if (segments.length !== 2) return null;
  const [localPart, rawDomain] = segments;
  if (!localPart.trim()) return null;

  const domain = rawDomain.trim().toLowerCase().replace(/^www\./, "");
  if (!domain || !domain.includes(".")) return null;

  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return null;

  const last = labels[labels.length - 1];
  const secondLast = labels[labels.length - 2];
  const stripped =
    labels.length >= 3 &&
    last.length === 2 &&
    SECOND_LEVEL_SUFFIXES.has(secondLast)
      ? labels.slice(0, -2)
      : labels.slice(0, -1);

  const brand = stripped[stripped.length - 1];
  if (!brand) return null;
  if (CONSUMER_MAIL_BRANDS.has(brand)) return null;

  return brand;
}

/**
 * Best-effort company name for an OAuth sign-up, e.g.
 * `sam@devoteam.com` → "Devoteam".
 *
 * Deliberately a starting point, not a source of truth: partners can rename
 * their company from the profile editor, and the onboarding wizard's website
 * import overwrites the surrounding detail anyway.
 */
export function companyNameFromEmail(email: string): string | null {
  const brand = brandLabelFromEmail(email);
  if (!brand) return null;

  if (ACRONYM_BRANDS.has(brand)) return brand.toUpperCase();

  return brand
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
