import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guard for fetching user-supplied URLs (SSRF protection).
 *
 * Any endpoint that takes a URL from a user and fetches it server-side can be
 * pointed at things the user cannot reach themselves: the cloud metadata
 * service, databases bound to localhost, other services inside the VPC. On
 * Cloud Run that includes 169.254.169.254, which issues service-account tokens.
 *
 * We resolve the hostname first and reject private, loopback, link-local and
 * reserved ranges. Resolving up front matters because a hostname the attacker
 * controls can point at 127.0.0.1 — checking only the literal string would miss
 * it.
 *
 * Note this does not close the TOCTOU gap where DNS is re-resolved to a
 * different address between our check and the fetch. Fully closing that needs a
 * custom agent that pins the validated IP; the checks here stop the realistic
 * cases (metadata IP, localhost, RFC1918) and are the right cost/benefit for
 * fetching public marketing pages.
 */

export class UnsafeUrlError extends Error {}

/** Blocked because reaching these from the server is never legitimate here. */
function isBlockedIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;

  if (a === 0) return true; // "this" network
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local — cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::1" || v === "::") return true; // loopback / unspecified
  if (v.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(v)) return true; // unique local
  // IPv4-mapped (::ffff:127.0.0.1) — re-check the embedded address.
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

/**
 * Validate a user-supplied URL for server-side fetching.
 * Returns the parsed URL, or throws `UnsafeUrlError` with a safe message.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https links are supported.");
  }

  // Credentials in the URL are a common way to confuse downstream parsers.
  if (u.username || u.password) {
    throw new UnsafeUrlError("Remove the credentials from that URL.");
  }

  const host = u.hostname.replace(/^\[|\]$/g, "");

  const literal = isIP(host);
  if (literal === 4) {
    if (isBlockedIpv4(host)) throw new UnsafeUrlError("That address isn't reachable.");
    return u;
  }
  if (literal === 6) {
    if (isBlockedIpv6(host)) throw new UnsafeUrlError("That address isn't reachable.");
    return u;
  }

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That address isn't reachable.");
  }

  // Resolve so a public-looking hostname can't point at a private address.
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("That domain could not be resolved.");
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError("That domain could not be resolved.");
  }
  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
    if (blocked) throw new UnsafeUrlError("That address isn't reachable.");
  }

  return u;
}
