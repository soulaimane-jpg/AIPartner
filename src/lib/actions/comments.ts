"use server";

/**
 * Comments — inline threaded comments anchored to brief sections.
 *
 * Anchor model: `(sectionKey, anchorOffset, anchorLength)`. Top-level
 * comments may have offset/length = 0 (section-anchored only). Replies
 * carry the parent's anchor implicitly.
 *
 * Authorisation:
 *   - **Brief owner** can comment, reply, resolve any thread.
 *   - **Collaborators** (`ACTIVE` status) can comment + reply on
 *     threads they didn't create. Resolving someone else's thread is
 *     reserved for the owner — feels less aggressive in practice.
 *   - **Admin** can do everything.
 *
 * Each successful action emits an in-app notification to the brief
 * owner + every active collaborator except the author.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";

/** Stable section keys the UI may target. Keeping these as a closed
 *  list catches typos at parse time and prevents cross-resource anchor
 *  abuse (e.g. comments on fields we don't render). */
const SECTION_KEYS = [
  "executiveSummary",
  "scopeRequirements",
  "integrationPoints",
  "dataSources",
  "successCriteria",
  "targetGoLive",
  "budgetRange",
  "preferredLocation",
  "requiredCertifications",
  "reviewWorkflow",
  "meeting",
  "general",
] as const;
const SectionKey = z.enum(SECTION_KEYS);

// ─── Helpers ─────────────────────────────────────────────────────

async function assertBriefAccess(
  briefId: string,
  userId: string,
  userEmail: string,
  role: string,
): Promise<{ ownerId: string; isOwner: boolean; isAdmin: boolean }> {
  const brief = await queryOne<{ ownerId: string }>(
    'SELECT "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });
  const isAdmin = role === "ADMIN";
  const isOwner = brief!.ownerId === userId;
  if (!isAdmin && !isOwner) {
    const seat = await queryOne<{ id: string }>(
      `SELECT "id" FROM "BriefCollaborator"
       WHERE "briefId" = $1 AND ("userId" = $2 OR "email" = $3)
         AND "status" <> 'REMOVED'
       LIMIT 1`,
      [briefId, userId, userEmail.toLowerCase()],
    );
    if (!seat) fail({ code: "FORBIDDEN" });
  }
  return { ownerId: brief!.ownerId, isOwner, isAdmin };
}

async function fanoutNotifications(
  briefId: string,
  authorId: string,
  notif: { title: string; message: string; type: string; link: string },
): Promise<void> {
  const [brief, collaborators] = await Promise.all([
    queryOne<{ ownerId: string }>(
      'SELECT "ownerId" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    ),
    query<{ userId: string | null }>(
      `SELECT "userId" FROM "BriefCollaborator"
       WHERE "briefId" = $1 AND "status" = 'ACTIVE' AND "userId" IS NOT NULL`,
      [briefId],
    ),
  ]);
  if (!brief) return;
  const recipients = new Set<string>();
  recipients.add(brief.ownerId);
  for (const c of collaborators) if (c.userId) recipients.add(c.userId);
  recipients.delete(authorId);
  if (recipients.size === 0) return;
  for (const userId of recipients) {
    await insertRow("Notification", { userId, ...notif });
  }
}

// ─── Create top-level comment ───────────────────────────────────

const CreateCommentInput = z.object({
  briefId: z.string().min(1),
  sectionKey: SectionKey,
  anchorOffset: z.coerce.number().int().nonnegative().default(0),
  anchorLength: z.coerce.number().int().nonnegative().default(0),
  body: z.string().trim().min(1).max(4000),
});

export const createCommentAction = defineAction({
  name: "comment.create",
  input: CreateCommentInput,
  output: z.object({ id: z.string() }),
  permission: "comment.create",
  rateLimit: { scope: "comment.create", limit: 60, windowSec: 60 },
  handler: async (
    { briefId, sectionKey, anchorOffset, anchorLength, body },
    ctx,
  ) => {
    await assertBriefAccess(
      briefId,
      ctx.user!.id,
      ctx.user!.email,
      ctx.user!.role,
    );
    const row = await insertRow<{ id: string }>("Comment", {
      briefId,
      sectionKey,
      anchorOffset,
      anchorLength,
      authorId: ctx.user!.id,
      body,
    });
    await fanoutNotifications(briefId, ctx.user!.id, {
      type: "comment.created",
      title: `${ctx.user!.name ?? "Someone"} commented on the brief`,
      message: body.slice(0, 240),
      link: `/briefs/${briefId}/preview#comment-${row.id}`,
    });
    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath(`/briefs/${briefId}/builder`);
    return { id: row.id };
  },
});

// ─── Reply ───────────────────────────────────────────────────────

const ReplyCommentInput = z.object({
  parentId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

export const replyToCommentAction = defineAction({
  name: "comment.reply",
  input: ReplyCommentInput,
  output: z.object({ id: z.string() }),
  permission: "comment.create",
  rateLimit: { scope: "comment.reply", limit: 60, windowSec: 60 },
  handler: async ({ parentId, body }, ctx) => {
    const parent = await queryOne<{
      id: string;
      briefId: string;
      sectionKey: string;
      anchorOffset: number;
      anchorLength: number;
    }>(
      `SELECT "id", "briefId", "sectionKey", "anchorOffset", "anchorLength"
       FROM "Comment" WHERE "id" = $1`,
      [parentId],
    );
    if (!parent) fail({ code: "NOT_FOUND", resource: "Comment" });
    await assertBriefAccess(
      parent!.briefId,
      ctx.user!.id,
      ctx.user!.email,
      ctx.user!.role,
    );
    const row = await insertRow<{ id: string }>("Comment", {
      briefId: parent!.briefId,
      sectionKey: parent!.sectionKey,
      anchorOffset: parent!.anchorOffset,
      anchorLength: parent!.anchorLength,
      parentId: parent!.id,
      authorId: ctx.user!.id,
      body,
    });
    await fanoutNotifications(parent!.briefId, ctx.user!.id, {
      type: "comment.reply",
      title: `${ctx.user!.name ?? "Someone"} replied on the brief`,
      message: body.slice(0, 240),
      link: `/briefs/${parent!.briefId}/preview#comment-${row.id}`,
    });
    revalidatePath(`/briefs/${parent!.briefId}/preview`);
    return { id: row.id };
  },
});

// ─── Resolve / unresolve ────────────────────────────────────────

const ResolveCommentInput = z.object({
  id: z.string().min(1),
  resolved: z.boolean(),
});

export const resolveCommentAction = defineAction({
  name: "comment.resolve",
  input: ResolveCommentInput,
  permission: "comment.resolve",
  rateLimit: { scope: "comment.resolve", limit: 60, windowSec: 60 },
  handler: async ({ id, resolved }, ctx) => {
    const row = await queryOne<{
      id: string;
      briefId: string;
      authorId: string;
    }>('SELECT "id", "briefId", "authorId" FROM "Comment" WHERE "id" = $1', [
      id,
    ]);
    if (!row) fail({ code: "NOT_FOUND", resource: "Comment" });
    const { isOwner, isAdmin } = await assertBriefAccess(
      row!.briefId,
      ctx.user!.id,
      ctx.user!.email,
      ctx.user!.role,
    );
    const isAuthor = row!.authorId === ctx.user!.id;
    if (!isOwner && !isAdmin && !isAuthor) {
      fail({
        code: "FORBIDDEN",
        reason: "Only the author or the brief owner can resolve this thread.",
      });
    }
    await updateRows(
      "Comment",
      { id },
      {
        resolvedAt: resolved ? new Date() : null,
        resolvedById: resolved ? ctx.user!.id : null,
      },
    );
    revalidatePath(`/briefs/${row!.briefId}/preview`);
    return { ok: true as const };
  },
});

// ─── Delete (author or owner) ────────────────────────────────────

const DeleteCommentInput = z.object({
  id: z.string().min(1),
});

export const deleteCommentAction = defineAction({
  name: "comment.delete",
  input: DeleteCommentInput,
  permission: "comment.create",
  rateLimit: { scope: "comment.delete", limit: 30, windowSec: 60 },
  handler: async ({ id }, ctx) => {
    const row = await queryOne<{
      id: string;
      briefId: string;
      authorId: string;
    }>('SELECT "id", "briefId", "authorId" FROM "Comment" WHERE "id" = $1', [
      id,
    ]);
    if (!row) fail({ code: "NOT_FOUND", resource: "Comment" });
    const { isOwner, isAdmin } = await assertBriefAccess(
      row!.briefId,
      ctx.user!.id,
      ctx.user!.email,
      ctx.user!.role,
    );
    const isAuthor = row!.authorId === ctx.user!.id;
    if (!isOwner && !isAdmin && !isAuthor) fail({ code: "FORBIDDEN" });
    await exec('DELETE FROM "Comment" WHERE "id" = $1', [id]);
    revalidatePath(`/briefs/${row!.briefId}/preview`);
    return { ok: true as const };
  },
});

// ─── Server-side reader ──────────────────────────────────────────

export async function listCommentsForBrief(briefId: string) {
  const rows = await query<{
    id: string;
    sectionKey: string;
    anchorOffset: number;
    anchorLength: number;
    parentId: string | null;
    body: string;
    resolvedAt: Date | null;
    createdAt: Date;
    authorId: string;
    authorName: string | null;
    authorEmail: string;
  }>(
    `SELECT c."id", c."sectionKey", c."anchorOffset", c."anchorLength",
            c."parentId", c."body", c."resolvedAt", c."createdAt",
            u."id" AS "authorId", u."name" AS "authorName", u."email" AS "authorEmail"
     FROM "Comment" c
     JOIN "User" u ON u."id" = c."authorId"
     WHERE c."briefId" = $1
     ORDER BY c."createdAt" ASC`,
    [briefId],
  );
  return rows.map((c) => ({
    id: c.id,
    sectionKey: c.sectionKey,
    anchorOffset: c.anchorOffset,
    anchorLength: c.anchorLength,
    parentId: c.parentId,
    body: c.body,
    author: { id: c.authorId, name: c.authorName, email: c.authorEmail },
    resolvedAt: c.resolvedAt,
    createdAt: c.createdAt,
  }));
}
