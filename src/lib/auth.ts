import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { env } from "@/env";
import { queryOne, insertRow, updateRows, tx } from "@/lib/db";
import type { UserRow } from "@/lib/db/rows";
import type { UserRole } from "@/lib/enums";
import { registerSession } from "@/lib/sessions";
import { audit } from "@/lib/audit";
import { sha256Hex } from "@/lib/crypto";
import { emailDomain } from "@/lib/partner-verification";
import type { ActionContext } from "@/lib/rbac/types";
import { authConfig } from "@/lib/auth.config";
import {
  SIGNUP_INTENT_COOKIE,
  companyNameFromEmail,
} from "@/lib/signup-intent";

/**
 * Edge-safe UUID. Web Crypto's `crypto.randomUUID()` is available on
 * both Node 19+ and the Edge runtime — the `node:crypto` import broke
 * middleware bundling because Webpack can't resolve `node:` schemes
 * for the Edge target.
 */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

/**
 * Read (and best-effort clear) the account type declared on the sign-up form.
 *
 * Set by `signInWithGoogleAction` immediately before the redirect to Google,
 * because the `signIn` callback below receives no `callbackUrl` to piggyback
 * on. Deletion is wrapped: cookie writes are only legal in some Next.js
 * contexts and a throw here would take the whole sign-in down, while a stale
 * cookie is harmless — it can only affect brand-new account creation, and it
 * expires within minutes either way.
 */
async function consumeSignupIntent(): Promise<"partner" | null> {
  try {
    const jar = await cookies();
    const value = jar.get(SIGNUP_INTENT_COOKIE)?.value ?? null;
    if (value) {
      try {
        jar.delete(SIGNUP_INTENT_COOKIE);
      } catch {
        /* read-only cookie context — the short TTL cleans up instead */
      }
    }
    return value === "partner" ? "partner" : null;
  } catch {
    return null;
  }
}

async function readSessionToken(): Promise<string | null> {
  try {
    const jar = await cookies();
    for (const name of SESSION_COOKIE_NAMES) {
      const v = jar.get(name)?.value;
      if (v) return v;
    }
  } catch {
    // cookies() is not available in some runtimes — silent skip.
  }
  return null;
}

async function readRequestMeta(): Promise<{
  ipHash: string | null;
  userAgent: string | null;
}> {
  try {
    const hdrs = await headers();
    const ua = hdrs.get("user-agent");
    const fwd = hdrs.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null;
    return {
      ipHash: ip ? sha256Hex(ip).slice(0, 32) : null,
      userAgent: ua,
    };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      companyId: string | null;
    };
  }
  interface User {
    role?: UserRole;
    companyId?: string | null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await queryOne<UserRow>(
          'SELECT * FROM "User" WHERE "email" = $1',
          [email],
        );
        if (!user) return null;
        // Google-only users have no password hash — they must use the
        // "Continue with Google" button, not this form.
        if (!user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          companyId: user.companyId,
        };
      },
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_SECRET ?? "",
      // Auth.js refuses by default to link an OAuth account to an existing
      // user with the same email (defence against email-spoof account
      // takeover). We accept the risk here because Google verifies the
      // email itself — the `signIn` callback below double-checks
      // `email_verified === true` before linking.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // Re-export jwt + session from the edge-safe config (they don't need DB
    // access). We add a `signIn` callback here because it does need the
    // Postgres pool for the Google upsert / link flow.
    ...authConfig.callbacks,
    /**
     * Node-side JWT callback with a self-heal step.
     *
     * The edge-safe base in `auth.config.ts` only writes token fields on
     * the initial sign-in (when `user` is defined). That's fine for most
     * cases — but Google-OAuth CUSTOMERs sign in *before* they pick a
     * Company in the onboarding survey, so their first token carries
     * `companyId: null`. Without a refresh, the token stays stale for
     * the whole 30-day session and every Company-scoped action (e.g.
     * brief.create) returns FORBIDDEN.
     *
     * We self-heal by re-reading `companyId` (and `role`, in case it
     * changed during a COLLABORATOR → CUSTOMER upgrade) from the DB
     * whenever the token has an id but no `companyId`. Once the survey
     * has linked a Company, this lookup picks it up on the next request
     * and never runs again.
     *
     * This callback runs in the Node runtime only — middleware bundles
     * `auth.config.ts` directly so it never touches the database here.
     */
    async jwt({ token, user, trigger }) {
      // Initial sign-in / Auth.js update — copy fields from `user` first.
      if (user) {
        token.id = (user as { id?: string }).id ?? (token.id as string);
        token.role = (user as { role?: UserRole }).role;
        token.companyId =
          (user as { companyId?: string | null }).companyId ?? null;
      }

      // Self-heal: refresh `companyId` (and `role`) from DB when the
      // token is missing them, or when a client explicitly asked for an
      // update (e.g. after the onboarding survey).
      if (token.id && (!token.companyId || trigger === "update")) {
        const fresh = await queryOne<{ companyId: string | null; role: string }>(
          'SELECT "companyId", "role" FROM "User" WHERE "id" = $1',
          [token.id as string],
        );
        if (fresh) {
          token.companyId = fresh.companyId;
          if (fresh.role) token.role = fresh.role as UserRole;
        }
      }

      return token;
    },
    async signIn({ user, account, profile }) {
      // Credentials path: `authorize()` already produced our shape; nothing to do.
      if (account?.provider !== "google") return true;

      // Defence in depth — Auth.js doesn't enforce this, we must.
      const verified = (profile as { email_verified?: boolean } | null)
        ?.email_verified;
      if (verified === false) {
        // Reject the sign-in with a readable error string in the URL.
        return "/auth/sign-in?error=GoogleEmailNotVerified";
      }

      const email = (user.email ?? "").trim().toLowerCase();
      if (!email) return false;

      const googleSub =
        (profile as { sub?: string } | null)?.sub ?? null;
      const avatar = user.image ?? null;

      // Upsert by email: link Google to an existing account if one already
      // exists, otherwise create a fresh account. New OAuth-only users
      // have no password hash — the Credentials authorize will reject
      // password sign-in for them (see above).
      //
      // Invite-aware role: if there's a pending BriefCollaborator row for
      // this email, the new account starts as `COLLABORATOR` (no
      // Company). Otherwise we default to `CUSTOMER`. Existing accounts
      // keep whatever role they already have.
      const existing = await queryOne<UserRow>(
        'SELECT * FROM "User" WHERE "email" = $1',
        [email],
      );
      let dbUser: UserRow;
      if (existing) {
        const [updated] = await updateRows<UserRow>(
          "User",
          { id: existing.id },
          {
            // Backfill googleId / avatar on first Google sign-in.
            googleId: existing.googleId ?? googleSub,
            image: existing.image ?? avatar,
            // Google emails are verified by Google itself.
            emailVerified: existing.emailVerified ?? new Date(),
            // Don't overwrite a real name the user already set.
            name: existing.name ?? user.name ?? null,
          },
        );
        dbUser = updated;
      } else {
        const pendingInvite = await queryOne(
          `SELECT 1 AS ok FROM "BriefCollaborator"
           WHERE "email" = $1 AND "status" = 'INVITED' LIMIT 1`,
          [email],
        );

        // A pending brief invite wins over a declared partner sign-up: the
        // invite is concrete evidence of why they're here, the tab selection
        // could just be whatever the form happened to be left on.
        const wantsPartner =
          !pendingInvite && (await consumeSignupIntent()) === "partner";

        if (wantsPartner) {
          // Partners are useless without a Company: `partnerCompanyId` rejects
          // every write, and the portal's onboarding gate skips anyone whose
          // `companyId` is null. So the company and profile are created here,
          // mirroring `signUpPartnerAction`, rather than deferred.
          const companyName = companyNameFromEmail(email);
          if (!companyName) {
            // Consumer mailbox — there's no company to infer. Send them back to
            // the form, which collects the name explicitly.
            return "/auth/sign-up?error=PartnerWorkEmailRequired";
          }
          dbUser = await tx(async (client) => {
            // Unverified until an admin approves — same gate as the
            // credentials path, so OAuth isn't a way around vetting.
            const company = await insertRow<{ id: string }>(
              "Company",
              {
                name: companyName,
                kind: "PARTNER",
                verificationStatus: "PENDING",
                signupEmailDomain: emailDomain(email),
              },
              { client },
            );
            await insertRow(
              "PartnerProfile",
              { companyId: company.id },
              { client },
            );
            return insertRow<UserRow>(
              "User",
              {
                email,
                name: user.name ?? null,
                googleId: googleSub,
                image: avatar,
                role: "PARTNER",
                companyId: company.id,
                emailVerified: new Date(),
              },
              { client },
            );
          });
        } else {
          const role: UserRole = pendingInvite ? "COLLABORATOR" : "CUSTOMER";
          dbUser = await insertRow<UserRow>("User", {
            email,
            name: user.name ?? null,
            googleId: googleSub,
            image: avatar,
            role,
            emailVerified: new Date(),
          });
        }
      }

      // Propagate our internal id / role / companyId to the user object so
      // the jwt callback in auth.config.ts writes them onto the token.
      user.id = dbUser.id;
      (user as { role?: UserRole }).role = dbUser.role as UserRole;
      (user as { companyId?: string | null }).companyId = dbUser.companyId;
      return true;
    },
  },
  events: {
    // Successful sign-in: register a row in our AuthSession ledger so
    // the user can manage the device later, and emit a structured
    // `auth.signIn` audit event. We deliberately swallow errors here
    // — Auth.js has already issued the cookie and we don't want a
    // ledger blip to fail the login.
    async signIn(message) {
      const userId = (message.user as { id?: string }).id;
      if (!userId) return;
      const token = await readSessionToken();
      const meta = await readRequestMeta();
      if (token) {
        await registerSession({
          userId,
          token,
          ipHash: meta.ipHash,
          userAgent: meta.userAgent,
        }).catch(() => undefined);
      }
      const ctx: ActionContext = {
        user: {
          id: userId,
          email: (message.user as { email?: string }).email ?? "",
          name: (message.user as { name?: string | null }).name ?? null,
          role:
            ((message.user as { role?: UserRole }).role as UserRole) ??
            "CUSTOMER",
          companyId:
            (message.user as { companyId?: string | null }).companyId ?? null,
        },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
        requestId: randomUUID(),
        traceId: null,
      };
      await audit(ctx, {
        kind: "auth.signIn",
        targetId: userId,
        targetType: "User",
        payload: { provider: "credentials" },
      }).catch(() => undefined);
    },
    async signOut(message) {
      // Auth.js passes either { token } (jwt strategy) or { session }.
      const userId = (
        (message as { token?: { id?: string } }).token?.id ??
        (message as { session?: { userId?: string } }).session?.userId
      ) as string | undefined;
      if (!userId) return;
      const meta = await readRequestMeta();
      const ctx: ActionContext = {
        user: {
          id: userId,
          email: "",
          name: null,
          role: "CUSTOMER",
          companyId: null,
        },
        ipHash: meta.ipHash,
        userAgent: meta.userAgent,
        requestId: randomUUID(),
        traceId: null,
      };
      await audit(ctx, {
        kind: "auth.signOut",
        targetId: userId,
        targetType: "User",
      }).catch(() => undefined);
    },
  },
});
