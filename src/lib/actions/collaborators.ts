"use server";

/**
 * Project-brief collaborators — invites, claim, approve, review notes.
 *
 * All user-facing actions wrapped in `defineAction`. The internal
 * helper `attachPendingInvitesToBrief` is intentionally session-checked
 * but unwrapped because it's invoked by other server actions (notably
 * `createBriefAction`), not by clients.
 */

import { z } from "zod";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import { COLLABORATOR_ROLES, type CollaboratorRole } from "@/lib/enums";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/provider";
import { renderCollaboratorInviteEmail } from "@/lib/email-templates";

/** Absolute URL the invitee opens to land on `/invite/[token]`. */
function inviteUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${base}/invite/${token}`;
}

/**
 * Render + send the collaborator invite email through the provider seam
 * (`sendEmail`). When `EMAIL_PROVIDER=smtp`, this actually delivers; in
 * dev (mock), it just persists the body to the `Email` table so the
 * customer can copy the magic link from the UI.
 *
 * Returns nothing — failures are isolated to a single row and won't
 * block the rest of the batch.
 */
export async function dispatchInviteEmail(opts: {
  toEmail: string;
  inviterName: string;
  briefTitle: string;
  role: CollaboratorRole;
  token: string;
  briefId: string;
}): Promise<void> {
  const { subject, body } = renderCollaboratorInviteEmail({
    inviterName: opts.inviterName,
    briefTitle: opts.briefTitle,
    role: opts.role,
    acceptUrl: inviteUrl(opts.token),
  });
  await sendEmail({
    toAddress: opts.toEmail,
    subject,
    body,
    kind: "collab-invite",
    briefId: opts.briefId,
  });
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

const InviteRow = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().optional().default(""),
  role: z.enum(COLLABORATOR_ROLES),
});

// ─── Per-brief invites ───────────────────────────────────────────
//
// The onboarding-pending stash (`inviteOnboardingCollaboratorsAction` +
// `attachPendingInvitesToBrief`) was removed: invites must originate
// from inside a specific brief so the customer explicitly chooses
// which SoW they're sharing.

const InviteForBriefInput = z.object({
  briefId: z.string().min(1),
  invites: z.array(InviteRow).min(1, "At least one invite required"),
});

export const inviteCollaboratorsAction = defineAction({
  name: "collaborator.invite",
  input: InviteForBriefInput,
  output: z.object({
    invited: z.number().int().nonnegative(),
    skipped: z.array(z.string()),
  }),
  permission: "collaborator.invite",
  rateLimit: { scope: "collaborator.invite", limit: 30, windowSec: 60 },
  handler: async ({ briefId, invites }, ctx) => {
    const brief = await queryOne<{ id: string; title: string }>(
      'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
      [briefId, ctx.user!.id],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    const myEmail = (ctx.user!.email ?? "").toLowerCase();
    const seen = new Set<string>();
    const skipped: string[] = [];

    const cleaned = invites
      .map((r) => ({
        ...r,
        email: r.email.trim().toLowerCase(),
        name: r.name?.trim() || null,
      }))
      .filter((r) => {
        if (r.email === myEmail) {
          skipped.push(`${r.email} (you)`);
          return false;
        }
        if (seen.has(r.email)) {
          skipped.push(`${r.email} (duplicate)`);
          return false;
        }
        seen.add(r.email);
        return true;
      });

    const briefTitle = brief!.title;
    const inviterName = ctx.user!.name ?? "Your colleague";

    let invited = 0;
    const createdRows: { token: string; email: string; role: CollaboratorRole }[] = [];
    for (const r of cleaned) {
      try {
        const token = generateToken();
        await insertRow("BriefCollaborator", {
          briefId,
          email: r.email,
          name: r.name,
          role: r.role,
          inviteToken: token,
          invitedById: ctx.user!.id,
        });
        invited++;
        createdRows.push({ token, email: r.email, role: r.role });
      } catch (e: unknown) {
        // 23505 = Postgres unique violation (already invited).
        if ((e as { code?: string }).code === "23505") {
          skipped.push(`${r.email} (already invited)`);
        } else {
          throw e;
        }
      }
    }

    // Fire the emails after the DB writes succeed. We `allSettled` so
    // one SMTP hiccup doesn't fail the whole batch — the rows are
    // already persisted, and the customer can hit "Resend" from the UI.
    await Promise.allSettled(
      createdRows.map((r) =>
        dispatchInviteEmail({
          toEmail: r.email,
          inviterName,
          briefTitle,
          role: r.role,
          token: r.token,
          briefId,
        }),
      ),
    );

    revalidatePath(`/briefs/${briefId}/preview`);
    revalidatePath(`/briefs/${briefId}/builder`);
    return { invited, skipped };
  },
});

// ─── Resend a still-INVITED collaborator email ───────────────────

const ResendInviteInput = z.object({
  collaboratorId: z.string().min(1),
});

export const resendCollaboratorInviteAction = defineAction({
  name: "collaborator.resend",
  input: ResendInviteInput,
  permission: "collaborator.invite",
  rateLimit: { scope: "collaborator.resend", limit: 10, windowSec: 60 },
  handler: async ({ collaboratorId }, ctx) => {
    const row = await queryOne<{
      id: string;
      briefId: string;
      email: string;
      role: string;
      status: string;
      inviteToken: string;
      briefOwnerId: string;
      briefTitle: string;
    }>(
      `SELECT bc."id", bc."briefId", bc."email", bc."role", bc."status", bc."inviteToken",
              b."ownerId" AS "briefOwnerId", b."title" AS "briefTitle"
       FROM "BriefCollaborator" bc
       JOIN "ProjectBrief" b ON b."id" = bc."briefId"
       WHERE bc."id" = $1`,
      [collaboratorId],
    );
    if (!row || row.briefOwnerId !== ctx.user!.id) {
      fail({ code: "FORBIDDEN" });
    }
    if (row!.status === "REMOVED") {
      fail({ code: "FORBIDDEN", reason: "This invite has been revoked." });
    }
    await dispatchInviteEmail({
      toEmail: row!.email,
      inviterName: ctx.user!.name ?? "Your colleague",
      briefTitle: row!.briefTitle,
      role: row!.role as CollaboratorRole,
      token: row!.inviteToken,
      briefId: row!.briefId,
    });
    return { ok: true as const };
  },
});

// ─── Remove collaborator ─────────────────────────────────────────

const RemoveCollaboratorInput = z.object({
  collaboratorId: z.string().min(1),
});

export const removeCollaboratorAction = defineAction({
  name: "collaborator.remove",
  input: RemoveCollaboratorInput,
  permission: "collaborator.remove",
  rateLimit: { scope: "collaborator.remove", limit: 30, windowSec: 60 },
  handler: async ({ collaboratorId }, ctx) => {
    const row = await queryOne<{
      id: string;
      briefId: string;
      briefOwnerId: string;
    }>(
      `SELECT bc."id", bc."briefId", b."ownerId" AS "briefOwnerId"
       FROM "BriefCollaborator" bc
       JOIN "ProjectBrief" b ON b."id" = bc."briefId"
       WHERE bc."id" = $1`,
      [collaboratorId],
    );
    if (!row || row.briefOwnerId !== ctx.user!.id) {
      fail({ code: "FORBIDDEN" });
    }

    await updateRows(
      "BriefCollaborator",
      { id: collaboratorId },
      { status: "REMOVED" },
    );
    revalidatePath(`/briefs/${row!.briefId}/preview`);
    revalidatePath(`/briefs/${row!.briefId}/builder`);
    return { ok: true as const };
  },
});

// ─── Approve / reject / review notes ─────────────────────────────

const ApproveInput = z.object({
  collaboratorId: z.string().min(1),
});

export const approveBriefAsCollaboratorAction = defineAction({
  name: "collaborator.approve",
  input: ApproveInput,
  permission: "collaborator.approve",
  rateLimit: { scope: "collaborator.approve", limit: 30, windowSec: 60 },
  handler: async ({ collaboratorId }, ctx) => {
    const row = await loadCollaboratorWithBrief(collaboratorId);
    if (!row) fail({ code: "NOT_FOUND", resource: "Invite" });
    if (row!.email.toLowerCase() !== (ctx.user!.email ?? "").toLowerCase()) {
      fail({
        code: "FORBIDDEN",
        reason: "This invite is for a different email.",
      });
    }
    if (row!.role !== "EDITOR" && row!.role !== "APPROVER") {
      fail({
        code: "FORBIDDEN",
        reason: "Only editors can approve the SoW.",
      });
    }

    await updateRows(
      "BriefCollaborator",
      { id: collaboratorId },
      {
        approvedAt: new Date(),
        rejectedAt: null,
        acceptedAt: row!.acceptedAt ?? new Date(),
        status: "ACTIVE",
        userId: ctx.user!.id,
      },
    );

    await insertRow("Notification", {
      userId: row!.briefOwnerId,
      type: "collaborator.approved",
      title: `${row!.name ?? row!.email} approved your SoW`,
      message: `Your project brief "${row!.briefTitle}" has been approved by an internal reviewer.`,
      link: `/briefs/${row!.briefId}/preview`,
    });

    revalidatePath(`/briefs/${row!.briefId}/preview`);
    return { ok: true as const };
  },
});

const RejectInput = z.object({
  collaboratorId: z.string().min(1),
  note: z.string().min(2).max(2000),
});

export const rejectBriefAsCollaboratorAction = defineAction({
  name: "collaborator.reject",
  input: RejectInput,
  permission: "collaborator.approve",
  rateLimit: { scope: "collaborator.reject", limit: 30, windowSec: 60 },
  handler: async ({ collaboratorId, note }, ctx) => {
    const row = await loadCollaboratorWithBrief(collaboratorId);
    if (!row) fail({ code: "NOT_FOUND", resource: "Invite" });
    if (row!.email.toLowerCase() !== (ctx.user!.email ?? "").toLowerCase()) {
      fail({
        code: "FORBIDDEN",
        reason: "This invite is for a different email.",
      });
    }
    if (row!.role !== "EDITOR" && row!.role !== "APPROVER") {
      fail({
        code: "FORBIDDEN",
        reason: "Only editors can reject the SoW.",
      });
    }

    await updateRows(
      "BriefCollaborator",
      { id: collaboratorId },
      {
        rejectedAt: new Date(),
        approvedAt: null,
        reviewNote: note,
        acceptedAt: row!.acceptedAt ?? new Date(),
        status: "ACTIVE",
        userId: ctx.user!.id,
      },
    );

    await insertRow("ChatMessage", {
      briefId: row!.briefId,
      userId: ctx.user!.id,
      role: "system",
      content: `❌ ${row!.name ?? row!.email} rejected the SoW: ${note}`,
    });

    await insertRow("Notification", {
      userId: row!.briefOwnerId,
      type: "collaborator.rejected",
      title: `${row!.name ?? row!.email} rejected your SoW`,
      message: note.slice(0, 240),
      link: `/briefs/${row!.briefId}/preview`,
    });

    revalidatePath(`/briefs/${row!.briefId}/preview`);
    revalidatePath(`/briefs/${row!.briefId}/builder`);
    return { ok: true as const };
  },
});

const ReviewNoteInput = z.object({
  collaboratorId: z.string().min(1),
  note: z.string().min(2).max(2000),
});

export const leaveReviewNoteAction = defineAction({
  name: "collaborator.review-note",
  input: ReviewNoteInput,
  permission: "comment.create",
  rateLimit: { scope: "collaborator.review-note", limit: 30, windowSec: 60 },
  handler: async ({ collaboratorId, note }, ctx) => {
    const row = await loadCollaboratorWithBrief(collaboratorId);
    if (!row) fail({ code: "NOT_FOUND", resource: "Invite" });
    if (row!.email.toLowerCase() !== (ctx.user!.email ?? "").toLowerCase()) {
      fail({
        code: "FORBIDDEN",
        reason: "This invite is for a different email.",
      });
    }

    await updateRows(
      "BriefCollaborator",
      { id: collaboratorId },
      {
        reviewNote: note,
        acceptedAt: row!.acceptedAt ?? new Date(),
        status: "ACTIVE",
        userId: ctx.user!.id,
      },
    );

    await insertRow("ChatMessage", {
      briefId: row!.briefId,
      userId: ctx.user!.id,
      role: "system",
      content: `💬 Review note from ${row!.name ?? row!.email}: ${note}`,
    });

    await insertRow("Notification", {
      userId: row!.briefOwnerId,
      type: "collaborator.reviewed",
      title: `${row!.name ?? row!.email} left a review note`,
      message: note.slice(0, 240),
      link: `/briefs/${row!.briefId}/preview`,
    });

    revalidatePath(`/briefs/${row!.briefId}/preview`);
    revalidatePath(`/briefs/${row!.briefId}/builder`);
    return { ok: true as const };
  },
});

// ─── Magic-link claim (server-component invoked) ─────────────────

/**
 * Claim a collaborator invite token. Called from a `/invite/[token]`
 * server action embedded in the page itself. Returns the brief id so
 * the page can `redirect()` after claiming. Keeps the throw-based
 * contract because it's not used from client transitions.
 */
export async function claimCollaboratorInviteAction(
  token: string,
): Promise<{ briefId: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(`/auth/sign-in?next=/invite/${token}`);
  }

  const row = await queryOne<{
    id: string;
    briefId: string;
    email: string;
    name: string | null;
    acceptedAt: Date | null;
    briefOwnerId: string;
    briefTitle: string;
  }>(
    `SELECT bc."id", bc."briefId", bc."email", bc."name", bc."acceptedAt",
            b."ownerId" AS "briefOwnerId", b."title" AS "briefTitle"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     WHERE bc."inviteToken" = $1`,
    [token],
  );
  if (!row) throw new Error("Invite invalid or revoked");
  if (row.email.toLowerCase() !== session.user.email.toLowerCase()) {
    throw new Error(
      `This invite was sent to ${row.email}. Please sign in with that email.`,
    );
  }

  await updateRows(
    "BriefCollaborator",
    { id: row.id },
    {
      status: "ACTIVE",
      acceptedAt: row.acceptedAt ?? new Date(),
      userId: session.user.id,
    },
  );

  // Notify the brief owner that someone joined. Best-effort; a notification
  // failure must not block the user's redirect to the brief.
  try {
    await insertRow("Notification", {
      userId: row.briefOwnerId,
      type: "collaborator.joined",
      title: `${row.name ?? row.email} joined your brief`,
      message: `${row.name ?? row.email} accepted the invite to collaborate on "${row.briefTitle}".`,
      link: `/briefs/${row.briefId}/preview`,
    });
  } catch {
    /* swallow — already claimed, owner stale, etc. */
  }

  return { briefId: row.briefId };
}

/** Collaborator row joined with the owning brief's owner + title. */
async function loadCollaboratorWithBrief(collaboratorId: string) {
  return queryOne<{
    id: string;
    briefId: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    acceptedAt: Date | null;
    briefOwnerId: string;
    briefTitle: string;
  }>(
    `SELECT bc."id", bc."briefId", bc."email", bc."name", bc."role",
            bc."status", bc."acceptedAt",
            b."ownerId" AS "briefOwnerId", b."title" AS "briefTitle"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     WHERE bc."id" = $1`,
    [collaboratorId],
  );
}

// Note: the legacy `renderCollaboratorEmail` helper that produced an
// inline mock-email body was removed. Email rendering now lives in
// `@/lib/email-templates → renderCollaboratorInviteEmail` and the
// dispatch happens via `sendEmail` (see `dispatchInviteEmail` above).
