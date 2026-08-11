import "server-only";

/**
 * Reads a partner profile out of the Google Cloud partner directory.
 *
 * The directory (cloud.google.com/find-a-partner) is a client-rendered app: the
 * HTML it serves contains ~13 characters of visible text and none of the
 * partner's data, for every user agent including crawlers. Fetching the page
 * and handing it to an LLM therefore extracts nothing.
 *
 * Rather than ship a headless Chromium just to run their JavaScript, we call
 * the same internal `batchexecute` RPC the page calls for its own data.
 *
 * ── On depending on a private endpoint ──────────────────────────────────────
 * This is undocumented and can change without notice. Two deliberate choices
 * keep that risk contained:
 *
 *  1. We do NOT map the response's positional arrays onto profile fields. That
 *     layout is exactly what Google is most likely to reshuffle, and a silent
 *     mis-map would write wrong data into a partner's profile. Instead we
 *     harvest every human-readable string and let the extraction model decide
 *     what each one means — so field order, additions and removals don't
 *     matter.
 *  2. Every structural assumption is checked, and failure raises
 *     `PartnerDirectoryError` with a message worth showing a user. It fails
 *     loudly and harmlessly instead of quietly returning junk.
 *
 * If Google ever retires this RPC, the fix is to render the page with a real
 * browser (see the note in scripts/setup-storage.sh's sibling discussion) or to
 * import from the partner's own website, which is server-rendered.
 */

/** RPC id the directory uses for a single partner lookup. */
const PARTNER_RPC_ID = "aqkqoe";

const DIRECTORY_ORIGIN = "https://cloud.google.com";
const BATCH_PATH = "/find-a-partner/_/PartnerFinder/data/batchexecute";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0 Safari/537.36";

/** Anything below this many characters means we got a shell, not real data. */
const MIN_USEFUL_CHARS = 200;

/** Upper bound on the text handed to the model, to bound token spend. */
const MAX_TEXT_CHARS = 60_000;

export class PartnerDirectoryError extends Error {}

/**
 * Pull the partner slug out of a directory URL.
 * Returns null for anything that isn't a partner detail page.
 */
export function parsePartnerSlug(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  // Exact host match — `(^|\.)google\.com$` style checks would also accept
  // evil-google.com.attacker.net style hosts on some parsers.
  if (u.hostname !== "cloud.google.com") return null;

  const m = u.pathname.match(/^\/find-a-partner\/partner\/([A-Za-z0-9._~-]+)\/?$/);
  return m ? m[1] : null;
}

/**
 * The RPC needs a build label and a session id, both of which are embedded in
 * the page shell and rotate over time. They must be read fresh per request.
 */
async function readShellTokens(
  slug: string,
  signal: AbortSignal,
): Promise<{ bl: string; sid: string }> {
  const res = await fetch(
    `${DIRECTORY_ORIGIN}/find-a-partner/partner/${encodeURIComponent(slug)}`,
    { headers: { "User-Agent": UA, Accept: "text/html" }, signal },
  );
  if (!res.ok) {
    throw new PartnerDirectoryError(
      `The Google Cloud directory returned ${res.status} for that partner.`,
    );
  }
  const html = await res.text();

  const bl = html.match(/boq_cloud-partner-finder_[0-9.]+_p[0-9]+/)?.[0];
  const sid = html.match(/"FdrFJe":"([^"]+)"/)?.[1];

  if (!bl || !sid) {
    throw new PartnerDirectoryError(
      "The Google Cloud directory page format changed and could not be read.",
    );
  }
  return { bl, sid };
}

/**
 * Unwrap a batchexecute response.
 *
 * The body is an anti-JSON-hijacking prefix followed by length-prefixed chunks:
 *
 *   )]}'
 *
 *   107
 *   [["wrb.fr","aqkqoe","<payload as a JSON string>",...],["di",159],...]
 *   25
 *   [["e",4,null,null,143]]
 *
 * We scan every chunk for the `wrb.fr` envelope belonging to our rpc id. A
 * failed call still returns HTTP 200 but carries a null payload, so a missing
 * payload is treated as an error rather than an empty result.
 */
function unwrapBatchExecute(raw: string, rpcId: string): unknown {
  const withoutPrefix = raw.replace(/^\)\]\}'\s*/, "");

  for (const line of withoutPrefix.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[")) continue;

    let chunk: unknown;
    try {
      chunk = JSON.parse(trimmed);
    } catch {
      continue; // Length markers and partial lines — skip.
    }
    if (!Array.isArray(chunk)) continue;

    for (const entry of chunk) {
      if (
        Array.isArray(entry) &&
        entry[0] === "wrb.fr" &&
        entry[1] === rpcId &&
        typeof entry[2] === "string"
      ) {
        try {
          return JSON.parse(entry[2]);
        } catch {
          throw new PartnerDirectoryError(
            "The Google Cloud directory returned a response we couldn't parse.",
          );
        }
      }
    }
  }

  throw new PartnerDirectoryError(
    "The Google Cloud directory returned no data for that partner. " +
      "Check the URL is a partner page you can open in a browser.",
  );
}

/**
 * Depth-first walk collecting human-readable strings.
 *
 * This is what makes the importer resilient: we never assume a field sits at a
 * particular index, only that the partner's text is somewhere in the payload.
 */
function harvestStrings(node: unknown, out: string[], depth = 0): void {
  if (depth > 40 || out.length > 4000) return;

  if (typeof node === "string") {
    const text = stripHtml(node);
    // Skip opaque ids ("profile/uQnCDFCbpD"), enum-ish tokens and empties.
    if (text.length < 2) return;
    if (/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]{6,}$/.test(text)) return;
    if (/^https?:\/\/\S+$/.test(text)) {
      out.push(text); // URLs are useful (website, case-study links).
      return;
    }
    if (!/[a-z]/i.test(text)) return; // pure punctuation/numbers
    out.push(text);
    return;
  }

  if (typeof node === "number" && Number.isFinite(node)) {
    // Counts (certified engineers, founding year) carry meaning.
    if (node > 1000000) return; // timestamps / ids
    out.push(String(node));
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) harvestStrings(child, out, depth + 1);
  }
}

/** The directory stores rich text as HTML fragments. */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch a partner's directory listing and return it as plain text suitable for
 * LLM extraction. Throws `PartnerDirectoryError` with a user-safe message.
 */
export async function fetchPartnerDirectoryText(
  slug: string,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { bl, sid } = await readShellTokens(slug, controller.signal);

    const url =
      `${DIRECTORY_ORIGIN}${BATCH_PATH}` +
      `?rpcids=${PARTNER_RPC_ID}` +
      `&source-path=${encodeURIComponent(`/find-a-partner/partner/${slug}`)}` +
      `&bl=${encodeURIComponent(bl)}` +
      `&f.sid=${encodeURIComponent(sid)}` +
      `&hl=en-US&_reqid=1&rt=c`;

    // Argument shape observed on the live page: [null, "<slug>"].
    const payload = JSON.stringify([
      [[PARTNER_RPC_ID, JSON.stringify([null, slug]), null, "generic"]],
    ]);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": UA,
      },
      body: `f.req=${encodeURIComponent(payload)}&`,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new PartnerDirectoryError(
        `The Google Cloud directory returned ${res.status}.`,
      );
    }

    const parsed = unwrapBatchExecute(await res.text(), PARTNER_RPC_ID);

    const parts: string[] = [];
    harvestStrings(parsed, parts);

    // Preserve first-seen order (name and tagline lead) while dropping repeats.
    const text = Array.from(new Set(parts)).join("\n").slice(0, MAX_TEXT_CHARS);

    if (text.length < MIN_USEFUL_CHARS) {
      throw new PartnerDirectoryError(
        "That partner page didn't contain enough information to import.",
      );
    }
    return text;
  } catch (err) {
    if (err instanceof PartnerDirectoryError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PartnerDirectoryError(
        "The Google Cloud directory took too long to respond. Please try again.",
      );
    }
    throw new PartnerDirectoryError(
      "Could not reach the Google Cloud partner directory.",
    );
  } finally {
    clearTimeout(timer);
  }
}
