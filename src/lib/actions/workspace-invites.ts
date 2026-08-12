"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { env } from "@/env";
import { exec, genId, queryOne, tx } from "@/lib/db";
import { sendEmail } from "@/lib/email/provider";
import { defineAction, fail } from "@/lib/actions/define";
import { notify } from "@/lib/notify";

const InviteRow = z.object({
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type WorkspaceInviteState = { error?: string; sent?: number } | undefined;

export async function inviteWorkspaceMembersAction(
  _previous: WorkspaceInviteState,
  formData: FormData,
): Promise<WorkspaceInviteState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) return { error: "Not signed in" };

  const emails = formData.getAll("inviteEmail").map(String);
  const roles = formData.getAll("inviteRole").map(String);
  const parsed = z.array(InviteRow).max(20).safeParse(
    emails.map((email, index) => ({ email, role: roles[index] ?? "MEMBER" })).filter((row) => row.email.trim()),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invite details" };
  if (parsed.data.length === 0) redirect("/onboarding/tutorial");

  const membership = await queryOne<{ role: string }>(
    `SELECT "role" FROM "WorkspaceMembership"
     WHERE "companyId" = $1 AND "userId" = $2 AND "status" = 'ACTIVE'`,
    [session.user.companyId, session.user.id],
  );
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return { error: "Only workspace Owners and Admins can invite members" };

  const ownEmail = session.user.email?.toLowerCase();
  const unique = new Map<string, (typeof parsed.data)[number]>();
  for (const invite of parsed.data) {
    const email = invite.email.toLowerCase();
    if (email !== ownEmail) unique.set(email, { ...invite, email });
  }

  const dispatch: Array<{ email: string; role: string; token: string }> = [];
  try {
    await tx(async (client) => {
      for (const invite of unique.values()) {
        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await client.query(
          `INSERT INTO "WorkspaceInvite"
             ("id", "companyId", "email", "role", "tokenHash", "status", "expiresAt", "invitedById", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'INVITED', NOW() + INTERVAL '7 days', $6, NOW(), NOW())
           ON CONFLICT ("companyId", lower("email")) WHERE "status" = 'INVITED'
           DO UPDATE SET "role" = EXCLUDED."role", "tokenHash" = EXCLUDED."tokenHash", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW()`,
          [genId(), session.user.companyId, invite.email, invite.role, tokenHash, session.user.id],
        );
        dispatch.push({ ...invite, token });
      }
    });
  } catch (err) {
    console.error("workspace invite save failed:", err);
    return { error: "Invites could not be saved. Please try again." };
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  await Promise.allSettled(
    dispatch.map((invite) =>
      sendEmail({
        toAddress: invite.email,
        subject: `You're invited to join AI Partner`,
        body: `Hello,\n\n${session.user.name ?? "A colleague"} has invited you to join their workspace on AI Partner.\n\nTo get started, please create your account by clicking the link below:\n\n${baseUrl}/auth/sign-up\n\nThis invitation expires in 7 days.\n\nIf you did not expect this invitation, you can safely ignore this email.\n\nBest regards,\nThe AI Partner Team`,
        kind: "workspace-invite",
      }),
    ),
  );
  revalidatePath("/settings/members");
  const returnTo = String(formData.get("returnTo") || "/onboarding/tutorial");
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/onboarding/tutorial");
}

// ─── Domain-based join requests ──────────────────────────────────

/**
 * Approve a colleague's request to join this workspace.
 *
 * Moves them off the stub company created at signup and onto the real
 * one. The stub is archived rather than deleted so any brief they
 * started before joining keeps its foreign key — orphaning a brief to
 * tidy up a Company row would be a bad trade.
 */
export const approveJoinRequestAction = defineAction({
  name: "workspace.join.approve",
  input: z.object({ requestId: z.string().min(1) }),
  permission: "tenant.member.invite",
  rateLimit: { scope: "workspace.join.approve", limit: 30, windowSec: 60 },
  handler: async ({ requestId }, ctx) => {
    const request = await queryOne<{
      id: string;
      companyId: string;
      requesterId: string;
      requesterCompanyId: string | null;
      status: string;
    }>(
      `SELECT "id", "companyId", "requesterId", "requesterCompanyId", "status"
       FROM "WorkspaceJoinRequest" WHERE "id" = $1`,
      [requestId],
    );
    if (!request) fail({ code: "NOT_FOUND", resource: "Join request" });
    if (request!.status !== "PENDING") {
      fail({ code: "CONFLICT", reason: "This request was already resolved." });
    }
    if (request!.companyId !== ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Not your workspace" });
    }

    const membership = await queryOne<{ role: string }>(
      `SELECT "role" FROM "WorkspaceMembership"
       WHERE "companyId" = $1 AND "userId" = $2 AND "status" = 'ACTIVE'`,
      [request!.companyId, ctx.user!.id],
    );
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      fail({
        code: "FORBIDDEN",
        reason: "Only workspace Owners and Admins can approve join requests.",
      });
    }

    await tx(async (client) => {
      await client.query(
        `INSERT INTO "WorkspaceMembership"
           ("id", "companyId", "userId", "role", "status", "invitedById", "joinedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', $4, NOW(), NOW(), NOW())
         ON CONFLICT ("companyId", "userId") DO UPDATE SET
           "status" = 'ACTIVE', "updatedAt" = NOW()`,
        [genId(), request!.companyId, request!.requesterId, ctx.user!.id],
      );
      await client.query(
        'UPDATE "User" SET "companyId" = $1, "updatedAt" = NOW() WHERE "id" = $2',
        [request!.companyId, request!.requesterId],
      );
      await client.query(
        `UPDATE "WorkspaceJoinRequest"
            SET "status" = 'APPROVED', "resolvedById" = $2, "resolvedAt" = NOW(), "updatedAt" = NOW()
          WHERE "id" = $1`,
        [requestId, ctx.user!.id],
      );
      // Retire the empty stub workspace so it stops appearing anywhere.
      if (request!.requesterCompanyId) {
        await client.query(
          `UPDATE "Company" SET "name" = "name" || ' (merged)', "updatedAt" = NOW()
            WHERE "id" = $1
              AND NOT EXISTS (
                SELECT 1 FROM "User" WHERE "companyId" = $1 AND "id" <> $2
              )`,
          [request!.requesterCompanyId, request!.requesterId],
        );
      }
    });

    await notify({
      event: "workspace.join_approved",
      recipients: [{ userId: request!.requesterId }],
      vars: { companyName: ctx.user!.companyId ?? "your team" },
      link: "/dashboard",
    });

    revalidatePath("/settings/members");
    return { ok: true as const };
  },
});

export const declineJoinRequestAction = defineAction({
  name: "workspace.join.decline",
  input: z.object({ requestId: z.string().min(1) }),
  permission: "tenant.member.invite",
  rateLimit: { scope: "workspace.join.decline", limit: 30, windowSec: 60 },
  handler: async ({ requestId }, ctx) => {
    const request = await queryOne<{ id: string; companyId: string }>(
      `SELECT "id", "companyId" FROM "WorkspaceJoinRequest"
       WHERE "id" = $1 AND "status" = 'PENDING'`,
      [requestId],
    );
    if (!request) fail({ code: "NOT_FOUND", resource: "Join request" });
    if (request!.companyId !== ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Not your workspace" });
    }
    await exec(
      `UPDATE "WorkspaceJoinRequest"
          SET "status" = 'DECLINED', "resolvedById" = $2, "resolvedAt" = NOW(), "updatedAt" = NOW()
        WHERE "id" = $1`,
      [requestId, ctx.user!.id],
    );
    revalidatePath("/settings/members");
    return { ok: true as const };
  },
});

/**
 * Accept a workspace invite.
 *
 * Returns a failure reason instead of redirecting on the unhappy path:
 * this used to `redirect("/workspace-invite/invalid")`, which matches
 * this very same dynamic route, so an expired or wrong-account invite
 * bounced between the page and itself forever.
 */
export type AcceptWorkspaceInviteResult =
  | { ok: false; reason: "expired" | "wrong_account" };

export async function acceptWorkspaceInviteAction(
  token: string,
): Promise<AcceptWorkspaceInviteResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect(`/auth/sign-up?next=/workspace-invite/${token}`);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await queryOne<{ id: string; companyId: string; email: string; role: string }>(
    `SELECT "id", "companyId", "email", "role" FROM "WorkspaceInvite"
     WHERE "tokenHash" = $1 AND "status" = 'INVITED' AND "expiresAt" > NOW()`,
    [tokenHash],
  );
  if (!invite) return { ok: false, reason: "expired" };
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return { ok: false, reason: "wrong_account" };
  }

  await tx(async (client) => {
    await client.query(
      `INSERT INTO "WorkspaceMembership" ("id", "companyId", "userId", "role", "status", "invitedById", "joinedAt", "createdAt", "updatedAt")
       SELECT $1, wi."companyId", $2, wi."role", 'ACTIVE', wi."invitedById", NOW(), NOW(), NOW()
       FROM "WorkspaceInvite" wi WHERE wi."id" = $3
       ON CONFLICT ("companyId", "userId") DO UPDATE SET "role" = EXCLUDED."role", "status" = 'ACTIVE', "updatedAt" = NOW()`,
      [genId(), session.user.id, invite.id],
    );
    await client.query('UPDATE "User" SET "companyId" = $1, "role" = \'CUSTOMER\', "updatedAt" = NOW() WHERE "id" = $2', [invite.companyId, session.user.id]);
    await client.query(`UPDATE "WorkspaceInvite" SET "status" = 'ACCEPTED', "acceptedById" = $2, "acceptedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`, [invite.id, session.user.id]);
  });
  redirect("/dashboard");
}
