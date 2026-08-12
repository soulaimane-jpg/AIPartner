/**
 * Sandbox demo session.
 *
 * Visitors of `/sandbox` get a no-auth, time-boxed demo. We create:
 *
 *   - One `User` (role CUSTOMER, password = random, email
 *     `sandbox+<token>@aipartner.demo` so it never collides with real
 *     accounts).
 *   - One `Company` (kind CUSTOMER, name "Sandbox Co").
 *   - One `ProjectBrief` pre-filled with a realistic example so the
 *     visitor lands on a populated detail page.
 *   - A `SandboxSession` row pointing at the demo user/brief and
 *     bearing a 32-byte token written to the visitor's cookie.
 *
 * Cleanup:
 *   - Default TTL is 60 minutes.
 *   - The nightly retention worker (Slice S2) will purge expired
 *     sessions + cascade-delete the synthetic user/brief.
 *
 * Why not a fully ephemeral in-memory mock? Because we want the demo
 * to exercise the *real* read paths — RBAC, rate-limit, audit log —
 * so prospects see what the product actually does, not a Storybook.
 */

import "server-only";
import { queryOne, insertRow } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import bcrypt from "bcryptjs";

export const SANDBOX_COOKIE = "aip_sandbox";
export const SANDBOX_TTL_MS = 60 * 60 * 1_000; // 60 minutes

export interface SandboxBoot {
  token: string;
  userId: string;
  briefId: string;
  expiresAt: Date;
}

export async function bootSandbox(opts: {
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<SandboxBoot> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SANDBOX_TTL_MS);

  // Create the synthetic company first so the user can link to it.
  const company = await insertRow<{ id: string }>("Company", {
    name: "Sandbox Co",
    kind: "CUSTOMER",
    industry: "Demo",
  });

  // Random password; the sandbox user can't sign in via Credentials.
  const passwordHash = await bcrypt.hash(randomToken(), 10);
  const email = `sandbox+${token.slice(0, 12)}@aipartner.demo`;

  const user = await insertRow<{ id: string }>("User", {
    email,
    name: "Demo Visitor",
    role: "CUSTOMER",
    passwordHash,
    companyId: company.id,
  });

  const brief = await insertRow<{ id: string }>("ProjectBrief", {
    title: "Migrating analytics warehouse to BigQuery",
    ownerId: user.id,
    companyId: company.id,
    stage: "REVIEW",
    leadState: "SENT_TO_PARTNERS",
    status: "ACTIVE",
    completion: 80,
    services: JSON.stringify(["data", "analytics", "migration"]),
    usesCloud: true,
    hadPartner: false,
    executiveSummary:
      "Mid-market retail company migrating from Redshift to BigQuery to consolidate analytics and unlock GenAI use-cases on Vertex AI.",
    scopeRequirements: JSON.stringify([
      "Lift-and-shift 14 TB of historical sales data",
      "Re-platform 90+ dbt models with minimal downtime",
      "Stand up reverse ETL into Salesforce and HubSpot",
      "Pilot Vertex AI Vector Search for product discovery",
    ]),
    successCriteria: JSON.stringify([
      "Cut overnight ETL runtime by 60%",
      "Sub-3-second p95 dashboard latency in Looker",
    ]),
    budgetRange: "$250K–$400K",
    preferredLocation: "EU (Frankfurt)",
    targetGoLive: "Q3 2026",
  });

  await insertRow("SandboxSession", {
    token,
    demoUserId: user.id,
    demoBriefId: brief.id,
    ipHash: opts.ipHash ?? null,
    userAgent: opts.userAgent?.slice(0, 240) ?? null,
    expiresAt,
  });

  return { token, userId: user.id, briefId: brief.id, expiresAt };
}

/** Read the session token from the request cookie. */
export async function findSandboxSessionByToken(
  token: string,
): Promise<{
  id: string;
  demoUserId: string | null;
  demoBriefId: string | null;
  expiresAt: Date;
} | null> {
  if (!token) return null;
  const session = await queryOne<{
    id: string;
    demoUserId: string | null;
    demoBriefId: string | null;
    expiresAt: Date;
  }>(
    `SELECT "id", "demoUserId", "demoBriefId", "expiresAt"
     FROM "SandboxSession" WHERE "token" = $1`,
    [token],
  );
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

/** Hash an IP for the audit fields (privacy by default). */
export function hashIpForSandbox(ip: string): string {
  return sha256Hex(ip);
}

function randomToken(): string {
  const a = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
