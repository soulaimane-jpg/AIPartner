import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { query, queryOne, count } from "@/lib/db";
import { PortalShellClient } from "./portal-shell-client";
import { getPortalNav, type PortalRole } from "./portal-nav-config";
import { hasAcceptedCurrentLegal } from "@/lib/legal/documents";
import type { UserRole } from "@/lib/enums";
import type { NotificationRow } from "@/lib/db/rows";

/**
 * Server‑side `<PortalShell />` — fetches the current session and any
 * portal‑wide counts (unread notifications, decisions due, etc.) and
 * hands the data off to the client coordinator.
 *
 * Used by every portal route group (`(portal)`, `google`, `partner/(portal)`).
 *
 * Pages render their own content as `children`; the shell provides the
 * rail, top bar, command palette and toaster.
 */
export async function PortalShell({
  children,
  /**
   * Pass the role(s) allowed to access the wrapped route group. If the
   * authenticated user's role isn't in the list, the shell redirects to
   * sign‑in. Defaults to allowing any signed‑in user.
   */
  allow,
  /** Path to redirect to when access is denied. */
  signInRedirect = "/auth/sign-in",
}: {
  children: React.ReactNode;
  allow?: PortalRole[];
  signInRedirect?: string;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(signInRedirect);
  }

  const role = (session.user.role ?? "CUSTOMER") as PortalRole;
  if (allow && !allow.includes(role)) {
    redirect(signInRedirect);
  }

  // First-run survey gate: a CUSTOMER who hasn't filled out their profile,
  // OR who still has no Company link (Google OAuth sign-ups arrive here
  // with companyId === null), is bounced to the onboarding wizard before
  // they can use the portal. Without a Company link, brief creation and
  // every other Company-scoped action fails with FORBIDDEN.
  //
  // ADMIN and other privileged roles can legitimately visit /dashboard
  // and the customer portal without their own Company — they're skipped.
  if (role === "CUSTOMER") {
    const me = await queryOne<{
      surveyCompletedAt: Date | null;
      companyId: string | null;
    }>(
      'SELECT "surveyCompletedAt", "companyId" FROM "User" WHERE "id" = $1',
      [session.user.id],
    );
    if (!me?.surveyCompletedAt || !me?.companyId) {
      redirect("/onboarding/survey");
    }
  }

  // Legal gate (plan-A M1): companies and partners must accept the
  // current version of their T&C + NDA before using the portal. A new
  // published version re-triggers this gate on next navigation.
  if (role === "CUSTOMER" || role === "COLLABORATOR" || role === "PARTNER") {
    const accepted = await hasAcceptedCurrentLegal(
      session.user.id,
      role as UserRole,
    );
    if (!accepted) {
      redirect("/legal/accept");
    }
  }

  const [notifications, decisionsDue, account] = await Promise.all([
    query<NotificationRow>(
      'SELECT * FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 8',
      [session.user.id],
    ),
    role === "CUSTOMER"
      ? count(
          `SELECT COUNT(*) FROM "ProjectBrief" b
           WHERE b."ownerId" = $1 AND b."status" <> 'ARCHIVED'
             AND (
               (b."stage" = 'REVIEW' AND EXISTS (
                 SELECT 1 FROM "Match" m WHERE m."briefId" = b."id" AND m."status" = 'SOURCED'
               ))
               OR (b."stage" IN ('PROPOSALS', 'SELECTION') AND EXISTS (
                 SELECT 1 FROM "Proposal" p WHERE p."briefId" = b."id" AND p."releasedAt" IS NOT NULL
               ))
             )`,
          [session.user.id],
        )
      : Promise.resolve(0),
    queryOne<{ name: string | null; email: string; image: string | null }>(
      'SELECT "name", "email", "image" FROM "User" WHERE "id" = $1',
      [session.user.id],
    ),
  ]);
  const unreadNotifications = notifications.filter((notification) => !notification.read).length;

  const inboxUnread =
    role === "PARTNER" && session.user.companyId
      ? await count(
          `SELECT COUNT(*) FROM "Match"
           WHERE "partnerId" = $1
             AND "status" = ANY($2::text[])`,
          [session.user.companyId, ["SOURCED", "INVITED", "REVIEW_APPROVED"]],
        )
      : 0;

  const nav = getPortalNav(role);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <PortalShellClient
      nav={nav}
      user={{
        name: account?.name ?? session.user.name ?? "",
        email: account?.email ?? session.user.email ?? "",
        image: account?.image?.startsWith("gcs:") ? "/api/account/avatar" : account?.image ?? null,
        role,
      }}
      badges={{
        "decisions-due": decisionsDue,
        "inbox-unread": inboxUnread,
      }}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      }))}
      notificationsCount={unreadNotifications}
      signOut={handleSignOut}
    >
      {children}
    </PortalShellClient>
  );
}
