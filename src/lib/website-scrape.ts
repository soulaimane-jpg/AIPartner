import "server-only";

/**
 * Reads a partner's own website as plain text for LLM extraction.
 *
 * The Google directory importer (`partner-directory.ts`) is scoped to one host
 * and one path shape, so the only caller-controlled value is a slug. This
 * module accepts an arbitrary URL, which makes SSRF the primary threat rather
 * than an afterthought. Defences, in order:
 *
 *  1. **Scheme allow-list.** http/https only — no `file:`, `gopher:`,
 *     `data:` or anything else a URL parser will happily accept.
 *  2. **DNS resolution before connect.** Every resolved address is checked
 *     against the private/reserved ranges. Hostname string matching alone is
 *     useless: `internal.example.com` can resolve to 10.0.0.5, and decimal or
 *     hex IP encodings bypass naive regexes.
 *  3. **Manual redirect following.** Each hop is re-validated. A public URL
 *     that 302s to `169.254.169.254` is the classic metadata-service escape.
 *  4. **Byte cap + timeout.** Streamed with a hard ceiling so a malicious or
 *     broken server cannot exhaust memory.
 *
 * Extraction quality is a secondary concern here: we strip to readable text
 * and let the model decide what things mean, exactly as the directory importer
 * does. That keeps both paths behaving the same way when markup changes.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class WebsiteScrapeError extends Error {}

const UA =
  "Mozilla/5.0 (compatible; AIPartnerBot/1.0; +https://aipartner.cloud/bot) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

/** Upper bound on text handed to the model, mirroring the directory importer. */
const MAX_TEXT_CHARS = 60_000;

/** Hard ceiling on bytes read off the wire. */
const MAX_BYTES = 3_000_000;

/** Anything shorter than this is a JS shell or an error page, not content. */
const MIN_USEFUL_CHARS = 400;

const MAX_REDIRECTS = 4;

/**
 * Reserved IPv4 ranges that must never be reachable.
 * Expressed as [network, maskBits] so the check is a prefix comparison rather
 * than a string match.
 */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], // "this host"
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // carrier NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local — cloud metadata lives here
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function isBlockedV4(ip: string): boolean {
  const addr = v4ToInt(ip);
  if (addr === null) return true; // unparseable → refuse
  for (const [net, bits] of BLOCKED_V4) {
    const netInt = v4ToInt(net);
    if (netInt === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((addr & mask) === (netInt & mask)) return true;
  }
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  // Unique-local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd]/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  // IPv4-mapped (::ffff:10.0.0.1) — validate the embedded address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  return false;
}

function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

/**
 * Validate a URL and confirm every address its host resolves to is public.
 *
 * Resolving here and rejecting on the result is what closes the DNS-rebinding
 * and "public name, private address" holes. There is still a theoretical TOCTOU
 * window between this check and the connect — closing that entirely requires
 * pinning the socket to a validated IP, which Node's fetch does not expose. For
 * a partner-initiated, authenticated, rate-limited import the residual risk is
 * acceptable; a background crawler over untrusted URLs would need the stronger
 * guarantee.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new WebsiteScrapeError("That doesn't look like a valid URL.");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new WebsiteScrapeError("Only http and https addresses can be read.");
  }
  if (u.username || u.password) {
    throw new WebsiteScrapeError("Remove credentials from the URL.");
  }

  const host = u.hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no DNS round-trip — check it directly.
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new WebsiteScrapeError("That address isn't publicly reachable.");
    }
    return u;
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new WebsiteScrapeError("That address isn't publicly reachable.");
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new WebsiteScrapeError("We couldn't resolve that domain.");
  }
  if (addresses.length === 0) {
    throw new WebsiteScrapeError("We couldn't resolve that domain.");
  }
  // ALL addresses must be public — a host with one public and one private
  // record could otherwise be used to reach the private one.
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new WebsiteScrapeError("That address isn't publicly reachable.");
    }
  }

  return u;
}

/** Read the body with a hard byte ceiling, regardless of Content-Length. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  // Stop the transfer if the server is still sending.
  await reader.cancel().catch(() => {});

  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    const room = Math.min(c.byteLength, total - offset);
    buf.set(c.subarray(0, room), offset);
    offset += room;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/** Fetch with manual redirect handling so every hop is re-validated. */
async function fetchValidated(
  startUrl: string,
  signal: AbortSignal,
): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);

    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new WebsiteScrapeError("That site returned an invalid redirect.");
      }
      current = new URL(location, url).toString();
      continue;
    }

    if (!res.ok) {
      throw new WebsiteScrapeError(`That site returned ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      throw new WebsiteScrapeError("That link isn't a web page.");
    }

    return { html: await readCapped(res), finalUrl: url.toString() };
  }

  throw new WebsiteScrapeError("That site redirected too many times.");
}

/**
 * Reduce HTML to readable text.
 *
 * Not a full readability implementation — script/style/nav removal plus tag
 * stripping gets the signal that matters (headings, paragraphs, list items)
 * and the model tolerates the noise that remains. Block-level tags become
 * newlines so the model can still see document structure.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Same-origin paths worth reading beyond the homepage. */
const CANDIDATE_PATHS = [
  "/about",
  "/services",
  "/what-we-do",
  "/solutions",
  "/case-studies",
];

/**
 * Fetch a partner's website as text, optionally sampling a few well-known
 * sub-pages.
 *
 * Homepages are often pure marketing; `/about` and `/services` carry the
 * capability detail. Sub-page failures are swallowed — a partial import is
 * still useful, and one 404 shouldn't sink the whole attempt.
 */
export async function fetchWebsiteText(
  rawUrl: string,
  {
    timeoutMs = 20_000,
    includeSubpages = true,
  }: { timeoutMs?: number; includeSubpages?: boolean } = {},
): Promise<{ text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { html, finalUrl } = await fetchValidated(rawUrl, controller.signal);
    const sections = [`# ${finalUrl}\n${htmlToText(html)}`];

    if (includeSubpages) {
      const origin = new URL(finalUrl).origin;
      for (const path of CANDIDATE_PATHS) {
        if (sections.join("\n").length > MAX_TEXT_CHARS) break;
        try {
          const sub = await fetchValidated(
            `${origin}${path}`,
            controller.signal,
          );
          const text = htmlToText(sub.html);
          if (text.length > MIN_USEFUL_CHARS) {
            sections.push(`# ${sub.finalUrl}\n${text}`);
          }
        } catch {
          // Missing sub-page is the norm, not an error worth reporting.
        }
      }
    }

    const text = sections.join("\n\n").slice(0, MAX_TEXT_CHARS);
    if (text.length < MIN_USEFUL_CHARS) {
      throw new WebsiteScrapeError(
        "That page didn't contain enough readable text to import. It may need JavaScript to render.",
      );
    }
    return { text, finalUrl };
  } catch (err) {
    if (err instanceof WebsiteScrapeError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new WebsiteScrapeError("That site took too long to respond.");
    }
    throw new WebsiteScrapeError("We couldn't reach that site.");
  } finally {
    clearTimeout(timer);
  }
}

// ─── Source routing ───────────────────────────────────────────

export type ImportSource =
  | { kind: "directory"; slug: string; url: string }
  | { kind: "website"; url: string };

/**
 * Decide how to read a URL.
 *
 * A Google directory link goes through the RPC path; anything else is treated
 * as the partner's own site. Keeping this decision in one function means the
 * API route, the wizard and the re-scrape job cannot disagree about it.
 */
export function resolveImportSource(
  rawUrl: string,
  parseDirectorySlug: (url: string) => string | null,
): ImportSource | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Partners paste bare domains constantly; assume https rather than failing.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const slug = parseDirectorySlug(withScheme);
  if (slug) return { kind: "directory", slug, url: withScheme };

  try {
    const u = new URL(withScheme);
    if (u.hostname === "cloud.google.com") {
      // A google.com link that isn't a partner detail page would scrape the
      // marketing site and extract nonsense.
      return null;
    }
    return { kind: "website", url: u.toString() };
  } catch {
    return null;
  }
}
