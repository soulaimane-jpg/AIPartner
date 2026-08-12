/**
 * Tag type-ahead for the partner profile pickers.
 *
 * GET /api/partner/tags?facet=workload&q=migra
 *   → { ok: true, tags: [{ id, label, status, useCount }] }
 *
 * Read-only and scoped to the curated library. Suggesting a *new* tag goes
 * through a Server Action instead (`suggestPartnerTagAction`) so it picks
 * up rate limiting and audit.
 *
 * Role-gated to PARTNER/ADMIN. It previously checked only that a session
 * existed, so any customer, collaborator or googler could enumerate the
 * curated tag library — which is the exact vocabulary `match-score-v2`
 * scores against, i.e. a map of what sourcing rewards.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isTagFacet } from "@/lib/partner-pillars";
import { searchTags, tagsByIds } from "@/lib/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== "PARTNER" && role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const facet = url.searchParams.get("facet") ?? "";
  const q = url.searchParams.get("q") ?? "";
  const ids = url.searchParams.get("ids");

  // Hydration path: the editor holds tag ids and needs labels to render
  // the chips on first paint.
  if (ids) {
    const tags = await tagsByIds(
      ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200),
    );
    return Response.json({
      ok: true,
      tags: tags.map(({ id, label, facet: f, status }) => ({
        id,
        label,
        facet: f,
        status,
      })),
    });
  }

  if (!isTagFacet(facet)) {
    return Response.json({ error: "Unknown facet" }, { status: 400 });
  }

  const tags = await searchTags(facet, q, 30);
  return Response.json({
    ok: true,
    tags: tags.map(({ id, label, status, useCount }) => ({
      id,
      label,
      status,
      useCount,
    })),
  });
}
