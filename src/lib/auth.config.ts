/**
 * Edge-safe NextAuth config — the slice that middleware bundles.
 *
 * Why split:
 *   The full `auth.ts` pulls in the Postgres pool, audit, sessions, and a Node
 *   `crypto` chain. None of that fits in the Edge runtime that
 *   middleware runs on. NextAuth v5's documented fix is to keep an
 *   Edge-compatible config (`auth.config.ts`) with only the static
 *   bits — pages, callbacks, and a placeholder `providers: []` —
 *   and let `auth.ts` extend it with Credentials + DB events.
 *
 *   Middleware imports `NextAuth(authConfig).auth` directly so the
 *   bundler never sees the heavy stuff.
 */

import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/enums";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/sign-in",
  },
  // Real providers live in `auth.ts` to keep middleware Edge-safe.
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: UserRole }).role;
        token.companyId =
          (user as { companyId?: string | null }).companyId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = (token.role as UserRole) ?? "CUSTOMER";
        session.user.companyId = (token.companyId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
