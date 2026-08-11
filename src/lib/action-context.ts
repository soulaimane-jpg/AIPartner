/**
 * Build an `ActionContext` for the current request.
 *
 * Server Actions in Next.js 15 don't expose request headers directly, so
 * we read them via `next/headers`. This module is server-only.
 */

import "server-only";
import { headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { env } from "@/env";
import type { UserRole } from "@/lib/enums";
import type { ActionContext } from "@/lib/rbac/types";

/**
 * HMAC-style hash of an IP, never reversible — what we actually persist
 * in `AuditLog.ipHash`. Falls back to AUTH_SECRET when AUDIT_HMAC_KEY
 * isn't set (fine in dev; production validation requires AUTH_SECRET).
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const key = env.AUDIT_HMAC_KEY ?? env.AUTH_SECRET ?? "dev-key";
  return createHash("sha256").update(`${key}|${ip}`).digest("hex").slice(0, 32);
}

/**
 * Read the best-guess client IP from common proxy headers. We hash it
 * before persistence — raw IPs are never stored.
 */
function readClientIp(h: Awaited<ReturnType<typeof headers>>): string | null {
  // x-forwarded-for: client, proxy1, proxy2 — take the leftmost
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("fly-client-ip") ||
    null
  );
}

export async function getActionContext(): Promise<ActionContext> {
  const [session, h] = await Promise.all([auth(), headers()]);
  const userAgent = h.get("user-agent");
  const requestId = h.get("x-request-id") ?? randomUUID();
  const traceId = h.get("traceparent") ?? null;
  const ip = readClientIp(h);
  return {
    user: session?.user
      ? {
          id: session.user.id,
          email: session.user.email ?? "",
          name: session.user.name ?? null,
          role: (session.user.role as UserRole) ?? "CUSTOMER",
          companyId: session.user.companyId ?? null,
        }
      : null,
    ipHash: hashIp(ip),
    userAgent: userAgent ? userAgent.slice(0, 256) : null,
    requestId,
    traceId,
  };
}
