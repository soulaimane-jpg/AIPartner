/**
 * Firewall-safe clarification-thread serialization (M9 + §8).
 *
 * Author labels are computed per viewing audience server-side —
 * the client component never sees cross-firewall identities:
 *   - company viewer: partner authors → match placeholder ("Partner A")
 *   - partner viewer: company authors → "The customer"
 *   - admin viewer: full labels (admins are inside the firewall)
 */

import "server-only";
import { query } from "@/lib/db";
import type {
  ClarificationThreadRow,
  ClarificationMessageRow,
} from "@/lib/db/rows";
import type { ThreadDTO } from "@/components/clarifications/thread-view";

type Audience = "company" | "partner" | "admin";

function authorLabelFor(opts: {
  audience: Audience;
  authorRole: string;
  mine: boolean;
  placeholderLabel: string | null;
  adminVisibleName?: string | null;
}): string {
  if (opts.mine) return "You";
  switch (opts.authorRole) {
    case "admin":
      return "The AIPartner team";
    case "partner":
      if (opts.audience === "company") {
        return opts.placeholderLabel ?? "A matched partner";
      }
      return opts.audience === "admin"
        ? (opts.adminVisibleName ?? "Partner")
        : "Your team";
    case "company":
      if (opts.audience === "partner") return "The customer";
      return opts.audience === "admin"
        ? (opts.adminVisibleName ?? "Customer")
        : "Your team";
    default:
      return "System";
  }
}

/**
 * Load and serialize the clarification threads on a brief for one
 * audience. `matchId` scopes partner viewers to their own threads.
 */
export async function loadThreadsForAudience(opts: {
  briefId: string;
  audience: Audience;
  viewerUserId: string;
  /** Partner viewers: only threads on their match. */
  matchId?: string;
  /** Filter by context types (defaults to all). */
  contextTypes?: string[];
}): Promise<ThreadDTO[]> {
  // Partners never see brief_triage (admin ↔ company) threads.
  const contextFilter =
    opts.audience === "partner"
      ? ["proposal_qc", "partner_question", "proposal_question"]
      : (opts.contextTypes ?? null);
  const threadRows = await query<ClarificationThreadRow>(
    `SELECT * FROM "ClarificationThread"
     WHERE "briefId" = $1
       AND ($2::text IS NULL OR "matchId" = $2)
       AND ($3::text[] IS NULL OR "contextType" = ANY($3))
     ORDER BY "createdAt" DESC`,
    [opts.briefId, opts.matchId ?? null, contextFilter],
  );
  const threadIds = threadRows.map((t) => t.id);
  const messageRows = threadIds.length
    ? await query<ClarificationMessageRow>(
        'SELECT * FROM "ClarificationMessage" WHERE "threadId" = ANY($1) ORDER BY "createdAt" ASC',
        [threadIds],
      )
    : [];
  const messagesByThread = new Map<string, ClarificationMessageRow[]>();
  for (const m of messageRows) {
    const list = messagesByThread.get(m.threadId) ?? [];
    list.push(m);
    messagesByThread.set(m.threadId, list);
  }
  const threads = threadRows.map((t) => ({
    ...t,
    messages: messagesByThread.get(t.id) ?? [],
  }));

  // Placeholder labels for partner-authored messages (company view).
  const matchIds = [
    ...new Set(threads.map((t) => t.matchId).filter((m): m is string => !!m)),
  ];
  const matches = matchIds.length
    ? await query<{ id: string; placeholderLabel: string | null; partnerName: string }>(
        `SELECT m."id", m."placeholderLabel", c."name" AS "partnerName"
         FROM "Match" m JOIN "Company" c ON c."id" = m."partnerId"
         WHERE m."id" = ANY($1)`,
        [matchIds],
      )
    : [];
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // Admin view needs author names.
  const authorIds =
    opts.audience === "admin"
      ? [...new Set(threads.flatMap((t) => t.messages.map((m) => m.authorId)))]
      : [];
  const authors = authorIds.length
    ? await query<{ id: string; name: string | null; email: string }>(
        'SELECT "id", "name", "email" FROM "User" WHERE "id" = ANY($1)',
        [authorIds],
      )
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a.name ?? a.email]));

  return threads.map((t) => {
    const match = t.matchId ? matchById.get(t.matchId) : undefined;
    return {
      id: t.id,
      contextType: t.contextType,
      anchorSectionKey: t.anchorSectionKey,
      status: t.status,
      resolution: t.resolution,
      messages: t.messages.map((m) => {
        const mine = m.authorId === opts.viewerUserId;
        let slots: { startsAt: string; durationMins: number }[] = [];
        try {
          slots = JSON.parse(m.slots) as typeof slots;
        } catch {
          slots = [];
        }
        return {
          id: m.id,
          mine,
          authorLabel: authorLabelFor({
            audience: opts.audience,
            authorRole: m.authorRole,
            mine,
            placeholderLabel: match?.placeholderLabel ?? null,
            adminVisibleName:
              opts.audience === "admin"
                ? m.authorRole === "partner"
                  ? (match?.partnerName ?? authorById.get(m.authorId))
                  : authorById.get(m.authorId)
                : null,
          }),
          kind: m.kind,
          body: m.body,
          slots,
          chosenSlot: m.chosenSlot,
          createdAt: m.createdAt.toISOString(),
        };
      }),
    };
  });
}
