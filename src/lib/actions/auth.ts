"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import {
  SIGNUP_INTENT_COOKIE,
  SIGNUP_INTENT_MAX_AGE,
} from "@/lib/signup-intent";
import { query, queryOne, insertRow, updateRows, tx } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email/provider";
import { renderPasswordResetEmail } from "@/lib/email-templates";
import {
  RESET_TOKEN_TTL_MINUTES,
  findUsableResetToken,
  hashResetToken,
  resetUrl,
} from "@/lib/auth/password-reset";
import {
  VERIFICATION_TOKEN_TTL_HOURS,
  createVerificationToken,
  verificationUrl,
} from "@/lib/auth/email-verification";
import { renderEmailVerificationEmail } from "@/lib/email-templates";
import { assessDomainEvidence } from "@/lib/partner-verification";
import { findWorkspaceByEmailDomain } from "@/lib/workspace-discovery";
import type { LeadRow, UserRow } from "@/lib/db/rows";
import type { AuthState } from "@/lib/types/auth";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  role: z.enum(["CUSTOMER", "PARTNER", "ADMIN"]).optional(),
  next: z.string().optional(),
});

function safeInternalPath(value: string | undefined, fallback: string): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Send the confirm-your-email link. Best-effort: a mail failure must
 * not block signup — the user can resend from their profile.
 */
async function sendVerificationEmail(opts: {
  userId: string;
  email: string;
  name: string | null;
}): Promise<void> {
  try {
    const token = await createVerificationToken({
      userId: opts.userId,
      email: opts.email,
    });
    const { subject, body } = renderEmailVerificationEmail({
      recipientName: opts.name ?? opts.email.split("@")[0],
      verificationUrl: verificationUrl(token),
      expiresIn: `${VERIFICATION_TOKEN_TTL_HOURS} hours`,
    });
    await sendEmail({
      toAddress: opts.email,
      subject,
      body,
      kind: "email-verification",
    });
  } catch (err) {
    console.warn("[auth] verification email failed", err);
  }
}

function authActionError(error: unknown, fallback: string): AuthState {
  if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
  const code = (error as { code?: string })?.code;
  if (code === "23505") return { error: "An account with this email already exists" };
  return { error: fallback };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") || undefined,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Invalid email or password" };

  const { email, password, role: requiredRole, next } = parsed.data;

  let role: string;
  try {
    const user = await queryOne<UserRow>(
      'SELECT * FROM "User" WHERE "email" = $1',
      [email],
    );
    if (!user) return { error: "Invalid email or password" };
    if (!user.passwordHash) {
      // Account exists but has no password — created via Google OAuth.
      return {
        error:
          "This account was created with Google. Use “Continue with Google” instead.",
      };
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return { error: "Invalid email or password" };
    if (requiredRole && user.role !== requiredRole && user.role !== "ADMIN") {
      return { error: `This account is not a ${requiredRole.toLowerCase()} account` };
    }
    role = user.role;
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (e) {
    return authActionError(e, "Sign-in failed. Check your connection and try again.");
  }

  const destination =
    next ||
    (role === "PARTNER"
      ? "/partner"
      : role === "ADMIN"
        ? "/admin"
        : role === "GOOGLER"
          ? "/google"
          : "/dashboard");
  redirect(safeInternalPath(destination, "/dashboard"));
}

/**
 * Server action wired to the "Continue with Google" buttons.
 *
 * NextAuth handles the OAuth dance itself — we just kick off the
 * redirect to Google's consent screen. After the round-trip the
 * `signIn` callback in `src/lib/auth.ts` upserts the user (creating a
 * fresh CUSTOMER account if needed) and the existing `events.signIn`
 * audit hook fires.
 *
 * `next` lets us preserve the original landing destination (e.g. a
 * deep-link the user hit before being bounced to /auth/sign-in).
 */
export async function signInWithGoogleAction(formData: FormData) {
  const requested = (formData.get("next") as string | null)?.trim();
  const isPartner = formData.get("kind") === "partner";

  // The `signIn` callback cannot see `redirectTo`, so the declared account type
  // travels in a cookie instead. Only ever set for the partner branch; the
  // absence of the cookie means "customer".
  const jar = await cookies();
  if (isPartner) {
    jar.set(SIGNUP_INTENT_COOKIE, "partner", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SIGNUP_INTENT_MAX_AGE,
    });
  } else {
    // Clear a stale value so switching tabs mid-signup can't mint a partner.
    jar.delete(SIGNUP_INTENT_COOKIE);
  }

  await signIn("google", {
    redirectTo: safeInternalPath(
      requested || undefined,
      isPartner ? "/partner" : "/dashboard",
    ),
  });
}

// Customer sign-up — accepts an optional `mode` flag. In "collab" mode
// (set by the invite-aware sign-up form) we don't ask for company /
// jobTitle / location and create a `COLLABORATOR` user with no Company.
const customerSignUpSchema = z
  .object({
    mode: z.enum(["customer", "collab"]).default("customer"),
    name: z.string().min(2, "Name is too short"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
    // Required only when mode === "customer"
    companyName: z.string().optional(),
    jobTitle: z.string().optional(),
    location: z.string().optional(),
    inviteToken: z.string().optional(),
    /** Brief-collaborator token (`/invite/[token]`) — sets mode=collab implicitly. */
    collabToken: z.string().optional(),
    /** Where to land after sign-up; used by collab mode to claim the invite. */
    next: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
    if (v.mode === "customer") {
      if (!v.companyName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companyName"],
          message: "Company name is required",
        });
      }
      if (!v.jobTitle || v.jobTitle.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobTitle"],
          message: "Your role helps partners tailor proposals",
        });
      }
      if (!v.location || v.location.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["location"],
          message: "Location helps match regional partners",
        });
      }
    }
  });

export async function signUpCustomerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const collabTokenRaw = (formData.get("collabToken") || "").toString().trim();
  const inferredMode = collabTokenRaw ? "collab" : (formData.get("mode") || "customer");
  const parsed = customerSignUpSchema.safeParse({
    mode: inferredMode,
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    location: formData.get("location"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteToken: formData.get("inviteToken") || undefined,
    collabToken: collabTokenRaw || undefined,
    next: formData.get("next") || undefined,
    confirmPassword: formData.get("confirmPassword") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const {
    mode,
    name,
    companyName,
    jobTitle,
    location,
    email,
    password,
    inviteToken,
    collabToken,
    next,
  } = parsed.data;
  const normalized = email.trim().toLowerCase();
  try {
    const exists = await queryOne<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "email" = $1',
      [normalized],
    );
    if (exists) return { error: "An account with this email already exists" };

  // ── Collaborator path ───────────────────────────────────────────
  if (mode === "collab") {
    // Validate the collaborator invite token matches the email.
    if (!collabToken) {
      return { error: "Missing invite token" };
    }
    const collab = await queryOne<{ email: string }>(
      'SELECT "email" FROM "BriefCollaborator" WHERE "inviteToken" = $1',
      [collabToken],
    );
    if (!collab) {
      return { error: "This invite link is invalid or has been revoked" };
    }
    if (collab.email.toLowerCase() !== normalized) {
      return {
        error: `This invite was sent to ${collab.email}. Please sign up with that email.`,
      };
    }
    const hash = await bcrypt.hash(password, 10);
    // No companyId, no jobTitle, no location — they're an
    // invite-only account scoped to specific briefs.
    await insertRow("User", {
      email: normalized,
      name,
      passwordHash: hash,
      role: "COLLABORATOR",
    });
    await signIn("credentials", { email: normalized, password, redirect: false });
    // /invite/[token] will pick up from here, claim the row, then
    // redirect to the brief.
    redirect(next || `/invite/${collabToken}`);
  }

  // ── Customer path (Googler-invite-aware, original behaviour) ────

  // If the user arrived via a Googler invite, validate the token.
  const invite = inviteToken
    ? await queryOne<LeadRow>(
        'SELECT * FROM "Lead" WHERE "inviteToken" = $1',
        [inviteToken],
      )
    : null;
  if (inviteToken && !invite) {
    return { error: "This invite link is invalid or has already been used" };
  }
  if (invite?.claimedUserId) {
    return { error: "This invite has already been claimed" };
  }
  if (invite && invite.customerEmail.toLowerCase() !== normalized) {
    return {
      error: `This invite was sent to ${invite.customerEmail}. Please sign up with that email.`,
    };
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await tx<{ id: string; companyId: string }>(async (client) => {
    const company = await insertRow<{ id: string }>(
      "Company",
      { name: companyName!.trim(), kind: "CUSTOMER" },
      { client },
    );
    const createdUser = await insertRow<{ id: string }>(
      "User",
      {
        email: normalized,
        name,
        passwordHash: hash,
        role: "CUSTOMER",
        jobTitle: jobTitle!,
        location: location!,
        companyId: company.id,
      },
      { client },
    );
    // The company creator is the workspace OWNER. Without this row the
    // owner can't invite members (inviteWorkspaceMembersAction gate).
    await insertRow(
      "WorkspaceMembership",
      {
        companyId: company.id,
        userId: createdUser.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      { client },
    );
    return { id: createdUser.id, companyId: company.id };
  });

  await sendVerificationEmail({ userId: user.id, email: normalized, name });

  // Workspace discovery: if colleagues from this email domain already
  // have a workspace, raise a join request rather than leaving the two
  // of them in separate invisible tenants. A REQUEST, not an auto-join
  // — brief access follows `companyId`, so silently attaching them
  // would expose every brief that company has written.
  try {
    const candidate = await findWorkspaceByEmailDomain(normalized);
    if (candidate && candidate.companyId !== user.companyId) {
      await insertRow("WorkspaceJoinRequest", {
        companyId: candidate.companyId,
        requesterId: user.id,
        requesterCompanyId: user.companyId,
        emailDomain: candidate.domain,
        status: "PENDING",
      });
      const owners = await query<{ id: string }>(
        `SELECT "userId" AS "id" FROM "WorkspaceMembership"
         WHERE "companyId" = $1 AND "status" = 'ACTIVE' AND "role" IN ('OWNER','ADMIN')`,
        [candidate.companyId],
      );
      await notify({
        event: "workspace.join_requested",
        recipients: owners.map((o) => ({ userId: o.id })),
        vars: {
          requesterName: name,
          requesterEmail: normalized,
          companyName: candidate.companyName,
        },
        link: "/settings/members",
      });
    }
  } catch (err) {
    // Discovery is a convenience — never block a signup on it.
    console.warn("[auth] workspace discovery failed", err);
  }

  // Link the Lead to the newly-created customer + notify the Googler.
  if (invite) {
    await updateRows(
      "Lead",
      { id: invite.id },
      {
        claimedUserId: user.id,
        claimedAt: new Date(),
        status: "CLAIMED",
      },
    );
    await notify({
      event: "lead.claimed",
      recipients: [{ userId: invite.googlerId }],
      vars: { customerName: name, companyName: companyName ?? "" },
      link: `/google/leads/${invite.id}`,
      idemKey: `claimed:${invite.id}`,
    });
  }

  await signIn("credentials", { email: normalized, password, redirect: false });
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding/survey");
  } catch (error) {
    return authActionError(error, "Account creation failed. Check your connection and try again.");
  }
}

// ── Collaborator → Customer upgrade ────────────────────────────────

const upgradeSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  jobTitle: z.string().min(2, "Job title helps partners tailor proposals"),
  location: z.string().min(2, "Location helps match regional partners"),
});

/**
 * Promote a `COLLABORATOR` account to a full `CUSTOMER`. Creates a new
 * Company and attaches it to the user. The existing brief
 * collaborations stay intact — the user keeps access to those briefs
 * AND now has their own dashboard + brief.create rights.
 *
 * Returns `{ ok: true }` on success or `{ error }` on validation /
 * state issues. Throws via `redirect()` for the happy path so the
 * caller's `<form>` reload reflects the new identity.
 */
export async function upgradeCollaboratorToCustomerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const session = await import("@/lib/auth").then((m) => m.auth());
  if (!session?.user?.id) return { error: "Not signed in" };
  if (session.user.role !== "COLLABORATOR") {
    return { error: "Only collaborator accounts can be upgraded" };
  }

  const parsed = upgradeSchema.safeParse({
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    location: formData.get("location"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { companyName, jobTitle, location } = parsed.data;

  await tx(async (client) => {
    const company = await insertRow<{ id: string }>(
      "Company",
      { name: companyName.trim(), kind: "CUSTOMER" },
      { client },
    );
    await updateRows(
      "User",
      { id: session.user.id },
      {
        role: "CUSTOMER",
        jobTitle,
        location,
        companyId: company.id,
      },
      { client },
    );
    // The upgraded collaborator owns the company they just created.
    await insertRow(
      "WorkspaceMembership",
      {
        companyId: company.id,
        userId: session.user.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      { client },
    );
  });

  redirect("/dashboard");
}

const partnerSignUpSchema = z
  .object({
    name: z.string().min(2),
    companyName: z.string().min(1),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export async function signUpPartnerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = partnerSignUpSchema.safeParse({
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, companyName, email, password } = parsed.data;
  const normalized = email.trim().toLowerCase();
  try {
    const exists = await queryOne<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "email" = $1',
      [normalized],
    );
    if (exists) return { error: "An account with this email already exists" };

  const hash = await bcrypt.hash(password, 10);
  // Partners start unverified: they cannot be sourced or invited until
  // an admin approves them. The signup domain is recorded as evidence
  // for that review, never as an automatic approval.
  const evidence = assessDomainEvidence({ email: normalized });
  const partnerUser = await tx(async (client) => {
    const company = await insertRow<{ id: string }>(
      "Company",
      {
        name: companyName,
        kind: "PARTNER",
        verificationStatus: "PENDING",
        signupEmailDomain: evidence.domain,
      },
      { client },
    );
    await insertRow("PartnerProfile", { companyId: company.id }, { client });
    return insertRow<{ id: string }>(
      "User",
      {
        email: normalized,
        name,
        passwordHash: hash,
        role: "PARTNER",
        companyId: company.id,
      },
      { client },
    );
  });
  await sendVerificationEmail({
    userId: partnerUser.id,
    email: normalized,
    name,
  });
  await signIn("credentials", { email: normalized, password, redirect: false });
  redirect("/partner");
  } catch (error) {
    return authActionError(error, "Partner account creation failed. Check your connection and try again.");
  }
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/");
}

// ── Password reset ────────────────────────────────────────────────
//
// Two-step flow:
//   1. `requestPasswordResetAction` — user submits their email, we mint a
//      single-use token and email the link.
//   2. `completePasswordResetAction` — user submits a new password with the
//      token from the link.
//
// Tokens are random 32-byte values; only their SHA-256 hash is stored, so a
// database leak cannot be replayed. Requests always report success so the
// endpoint can't be used to enumerate which emails have accounts.

/** Generic reply used for every outcome of a reset request. */
const RESET_REQUESTED_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password. Check your inbox and spam folder.";

const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }
  const { email } = parsed.data;

  try {
    const user = await queryOne<{
      id: string;
      name: string | null;
      passwordHash: string | null;
    }>('SELECT "id", "name", "passwordHash" FROM "User" WHERE "email" = $1', [
      email,
    ]);

    // Only password accounts can be reset. Google-only accounts have no
    // password to change — we still return the generic message so the
    // response is indistinguishable.
    if (user?.passwordHash) {
      // Invalidate any outstanding tokens so only the newest link works.
      await query(
        `UPDATE "PasswordResetToken"
            SET "usedAt" = NOW()
          WHERE "userId" = $1 AND "usedAt" IS NULL`,
        [user.id],
      );

      const token = randomBytes(32).toString("hex");
      await insertRow(
        "PasswordResetToken",
        {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
        },
        { noUpdatedAt: true },
      );

      const { subject, body } = renderPasswordResetEmail({
        recipientName: user.name ?? email.split("@")[0],
        resetUrl: resetUrl(token),
        expiresIn: `${RESET_TOKEN_TTL_MINUTES} minutes`,
      });
      await sendEmail({
        toAddress: email,
        subject,
        body,
        kind: "password-reset",
      });
    }
  } catch {
    // Never leak infrastructure errors here — the user would learn nothing
    // actionable and it would differentiate existing from missing accounts.
    return { success: RESET_REQUESTED_MESSAGE };
  }

  return { success: RESET_REQUESTED_MESSAGE };
}

const completeResetSchema = z
  .object({
    token: z.string().trim().min(16),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export async function completePasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = completeResetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { token, password } = parsed.data;

  try {
    const row = await findUsableResetToken(token);
    if (!row) {
      return {
        error:
          "This reset link is invalid or has expired. Request a new one and try again.",
      };
    }

    const hash = await bcrypt.hash(password, 10);
    await tx(async (client) => {
      await updateRows(
        "User",
        { id: row.userId },
        { passwordHash: hash },
        { client },
      );
      await updateRows(
        "PasswordResetToken",
        { id: row.id },
        { usedAt: new Date() },
        { client, noUpdatedAt: true },
      );
      // Changing a password ends every other session — a reset is the
      // remedy for a suspected compromise, so old cookies must stop working.
      await client.query(
        `UPDATE "AuthSession" SET "revokedAt" = NOW()
          WHERE "userId" = $1 AND "revokedAt" IS NULL`,
        [row.userId],
      );
    });
  } catch (error) {
    return authActionError(
      error,
      "We couldn't reset your password. Please try again.",
    );
  }

  redirect("/auth/sign-in?reset=1");
}
