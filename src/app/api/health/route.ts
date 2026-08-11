/**
 * Health endpoint — used by load balancers, uptime monitors, and the
 * deployment platform's readiness probe.
 *
 * **Liveness vs readiness**: this endpoint is *readiness*. It checks
 * the things a pod needs to serve real traffic — currently a `SELECT 1`
 * against the database. A separate `/api/live` endpoint can be added
 * if we ever need to distinguish (e.g. Kubernetes-style probes).
 *
 * Always returns JSON. Status code 200 = healthy, 503 = degraded.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { env } from "@/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function checkDb(): Promise<CheckResult> {
  if (!env.DATABASE_URL) return { ok: true }; // dev without DB
  const start = Date.now();
  try {
    await query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

export async function GET() {
  const [db] = await Promise.all([checkDb()]);
  const ok = db.ok;
  const body = {
    ok,
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    checks: { db },
  };
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
