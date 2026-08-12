/**
 * Workspace search backing the ⌘K palette.
 *
 * The palette advertised "Search briefs, partners, actions…" but was only
 * ever populated with static navigation entries — `recents` defaulted to
 * `[]` and nothing ever passed it — so typing a brief title returned
 * "No matches". This makes the search real.
 *
 * Two rules govern every query here:
 *
 *  1. **Tenancy.** Results are scoped to what the caller may already open.
 *     Never resolve a row by a client-supplied id; the query itself carries
 *     the scope.
 *  2. **Identity firewall.** A customer must not be able to discover partner
 *     companies by name before the reveal. Customers therefore get no
 *     partner results at all — not filtered ones, none — and matched
 *     partners are surfaced only to admins.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchGroup = "Brief" | "Lead" | "Partner" | "Person";

export interface SearchHit {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: SearchGroup;
}

const MAX_PER_GROUP = 6;

/** `%term%` with LIKE wildcards escaped so user input can't widen the match. */
function likeTerm(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  // Search is cheap but unauthenticated-adjacent (any signed-in user can
  // probe it), so keep it bounded per user.
  const limited = await checkRateLimit({
    key: `user:${session.user.id}:search`,
    limit: 60,
    windowSec: 60,
  });
  if (limited.limited) {
    return NextResponse.json(
      { ok: false, error: "Too many searches" },
      { status: 429 },
    );
  }

  const role = session.user.role ?? "CUSTOMER";
  const userId = session.user.id;
  const companyId = session.user.companyId ?? null;
  const term = likeTerm(q);
  const results: SearchHit[] = [];

  try {
    if (role === "ADMIN") {
      const [briefs, partners, people] = await Promise.all([
        query<{ id: string; title: string; stage: string }>(
          `SELECT "id", "title", "stage" FROM "ProjectBrief"
            WHERE "title" ILIKE $1 ESCAPE '\\'
            ORDER BY "updatedAt" DESC LIMIT $2`,
          [term, MAX_PER_GROUP],
        ),
        query<{ id: string; name: string }>(
          `SELECT "id", "name" FROM "Company"
            WHERE "kind" = 'PARTNER' AND "name" ILIKE $1 ESCAPE '\\'
            ORDER BY "name" ASC LIMIT $2`,
          [term, MAX_PER_GROUP],
        ),
        query<{ id: string; email: string; name: string | null }>(
          `SELECT "id", "email", "name" FROM "User"
            WHERE ("email" ILIKE $1 ESCAPE '\\' OR "name" ILIKE $1 ESCAPE '\\')
            ORDER BY "createdAt" DESC LIMIT $2`,
          [term, MAX_PER_GROUP],
        ),
      ]);
      for (const b of briefs) {
        results.push({
          id: b.id,
          label: b.title,
          hint: b.stage,
          href: `/admin/briefs/${b.id}`,
          group: "Brief",
        });
      }
      for (const p of partners) {
        results.push({
          id: p.id,
          label: p.name,
          hint: "Partner",
          href: `/admin/partners/${p.id}`,
          group: "Partner",
        });
      }
      for (const u of people) {
        results.push({
          id: u.id,
          label: u.name ?? u.email,
          hint: u.email,
          href: `/admin/users`,
          group: "Person",
        });
      }
    } else if (role === "PARTNER") {
      // Only briefs this partner is actually matched to.
      const briefs = await query<{ id: string; title: string; status: string }>(
        `SELECT b."id", b."title", m."status"
           FROM "ProjectBrief" b
           JOIN "Match" m ON m."briefId" = b."id"
          WHERE m."partnerId" = $1
            AND b."title" ILIKE $2 ESCAPE '\\'
          ORDER BY b."updatedAt" DESC
          LIMIT $3`,
        [companyId, term, MAX_PER_GROUP],
      );
      for (const b of briefs) {
        results.push({
          id: b.id,
          label: b.title,
          hint: b.status,
          href: `/partner/briefs/${b.id}`,
          group: "Brief",
        });
      }
    } else if (role === "GOOGLER") {
      const leads = await query<{
        id: string;
        companyName: string | null;
        customerDomain: string;
        status: string;
      }>(
        `SELECT "id", "companyName", "customerDomain", "status"
           FROM "Lead"
          WHERE "googlerId" = $1
            AND ("companyName" ILIKE $2 ESCAPE '\\'
                 OR "customerDomain" ILIKE $2 ESCAPE '\\'
                 OR "customerEmail" ILIKE $2 ESCAPE '\\')
          ORDER BY "invitedAt" DESC
          LIMIT $3`,
        [userId, term, MAX_PER_GROUP],
      );
      for (const l of leads) {
        results.push({
          id: l.id,
          label: l.companyName ?? l.customerDomain,
          hint: l.status,
          href: `/google/leads/${l.id}`,
          group: "Lead",
        });
      }
    } else {
      // CUSTOMER / COLLABORATOR — briefs they own, that belong to their
      // company, or that they were explicitly invited to. Deliberately no
      // partner results: partner identity is gated behind the reveal, and a
      // searchable directory would be a way around it.
      const briefs = await query<{ id: string; title: string; stage: string }>(
        `SELECT DISTINCT b."id", b."title", b."stage", b."updatedAt"
           FROM "ProjectBrief" b
           LEFT JOIN "BriefCollaborator" bc
             ON bc."briefId" = b."id"
            AND lower(bc."email") = lower($2)
            AND bc."status" <> 'REMOVED'
          WHERE b."title" ILIKE $3 ESCAPE '\\'
            AND (
              b."ownerId" = $1
              OR ($4::text IS NOT NULL AND b."companyId" = $4)
              OR bc."id" IS NOT NULL
            )
          ORDER BY b."updatedAt" DESC
          LIMIT $5`,
        [userId, session.user.email ?? "", term, companyId, MAX_PER_GROUP],
      );
      for (const b of briefs) {
        results.push({
          id: b.id,
          label: b.title,
          hint: b.stage,
          href: `/briefs/${b.id}/preview`,
          group: "Brief",
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    // Search failing must not break the palette — return empty and report.
    const { captureError } = await import("@/lib/observability");
    captureError(err, { scope: "search", userId, role });
    return NextResponse.json({ ok: true, results: [] });
  }
}
