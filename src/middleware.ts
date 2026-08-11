import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Middleware runs on the Edge runtime — it can't bundle Node-only
 * code (the Postgres pool, `node:crypto`, audit, etc.). We therefore initialise
 * NextAuth here with the slim Edge-compatible `authConfig` so the
 * heavy Credentials provider + DB events stay out of this bundle.
 *
 * Sign-in still happens through the full handler exported from
 * `@/lib/auth`; here we only need session verification + role gates.
 */
const { auth } = NextAuth(authConfig);

// Protect sensitive surfaces based on role.
export default auth((req) => {
  // Canonical host: auth cookies (session, OAuth PKCE) are host-only, so
  // serving both www and apex breaks Google sign-in callbacks and sessions.
  // 301 everything on www.* to the apex domain.
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = req.nextUrl.clone();
    url.host = host.slice(4);
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  // Public routes
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/partner/login") ||
    pathname.startsWith("/partner/register") ||
    pathname.startsWith("/partner/accept") || // tokenised T&C click-in (no session required)
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/api/auth") ||
    // Slice 5 — public marketing surfaces
    pathname === "/sandbox" ||
    pathname === "/partners" ||
    pathname.startsWith("/partners/") ||
    pathname === "/trust" ||
    pathname === "/for-googlers" ||
    // Slice 5 — public API (auth handled per-route via bearer key) +
    // anonymous sandbox bootstrap.
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/sandbox/") ||
    // Scheduler-driven jobs. These have no user session by definition, so the
    // session gate below would bounce them to /auth/sign-in and every cron
    // (retention purge, digests, timers) would silently never run. Each route
    // authenticates itself against CRON_SECRET as a bearer token.
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt";

  if (isPublic) return NextResponse.next();

  if (!session) {
    const loginUrl = pathname.startsWith("/partner")
      ? new URL("/partner/login", req.url)
      : pathname.startsWith("/admin")
        ? new URL("/admin/login", req.url)
        : new URL("/auth/sign-in", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/partner") && role !== "PARTNER" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/google") && role !== "GOOGLER" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Collaborators can read briefs they're on (per-row check happens in the
  // page's RBAC check) but never see /dashboard, /onboarding, or marketing
  // surfaces. Bounce them to their constrained landing.
  if (role === "COLLABORATOR") {
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/partners")
    ) {
      return NextResponse.redirect(new URL("/collaborations", req.url));
    }
  }

  if (
    (pathname === "/dashboard" || pathname.startsWith("/briefs")) &&
    role !== "CUSTOMER" &&
    role !== "ADMIN" &&
    role !== "COLLABORATOR" // collaborators may visit /briefs/[id] — the RBAC `brief.read` check guards per-row
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // /account is reachable from every signed-in role for managing the
  // user's own security & profile — no extra role gating beyond auth.
  // (no-op branch kept for clarity / future extension)

  return withPrivateCacheHeaders(NextResponse.next());
});

/**
 * Mark every authenticated response as non-cacheable.
 *
 * This is a multi-tenant app: any response past the session gate is scoped to
 * one company and frequently contains personal data. Without an explicit
 * directive a CDN, corporate proxy, or the browser's back/forward cache can
 * retain it and later serve it to a different user or tenant — a GDPR
 * confidentiality breach (art. 5(1)(f)) as well as a data-leak bug.
 *
 * `private` forbids shared caches, `no-store` prevents writing to disk at all,
 * and `must-revalidate` + `Vary: Cookie` stop a cached copy being reused across
 * sessions. Public marketing pages return earlier via `isPublic` and stay
 * cacheable.
 */
function withPrivateCacheHeaders(res: NextResponse): NextResponse {
  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );
  res.headers.set("Vary", "Cookie");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|.*\\..*).*)"],
};
