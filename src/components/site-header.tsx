import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { SiteNav, type NavLink } from "@/components/site-nav";
import { UserMenu, type UserMenuItem } from "@/components/user-menu";

function primaryNav(role?: string | null): NavLink[] {
  if (role === "ADMIN") {
    return [
      { href: "/admin", label: "Overview" },
      { href: "/admin/briefs", label: "Briefs" },
      { href: "/admin/matches", label: "Matches" },
      { href: "/admin/partners", label: "Partners" },
      { href: "/admin/users", label: "Users" },
    ];
  }
  if (role === "PARTNER") {
    return [
      { href: "/partner", label: "Inbox" },
      { href: "/partner/profile", label: "Profile" },
    ];
  }
  if (role === "CUSTOMER") {
    return [
      { href: "/dashboard", label: "Projects" },
      { href: "/profile", label: "Profile" },
    ];
  }
  if (role === "GOOGLER") {
    return [
      { href: "/google", label: "Overview" },
      { href: "/google/leads", label: "Leads" },
      { href: "/google/leads/new", label: "Refer" },
    ];
  }
  return [];
}

function userMenuItems(role?: string | null): UserMenuItem[] {
  // Same Security entry for every signed-in role.
  const security: UserMenuItem = {
    label: "Security",
    href: "/account/security",
    icon: "shield",
  };
  if (role === "ADMIN") {
    return [
      { label: "Overview", href: "/admin", icon: "dashboard" },
      { label: "Users",    href: "/admin/users", icon: "user" },
      security,
    ];
  }
  if (role === "PARTNER") {
    return [
      { label: "Inbox",   href: "/partner",         icon: "folder" },
      { label: "Profile", href: "/partner/profile", icon: "settings" },
      security,
    ];
  }
  if (role === "CUSTOMER") {
    return [
      { label: "Projects", href: "/dashboard", icon: "folder" },
      { label: "Account", href: "/account", icon: "settings" },
      security,
    ];
  }
  if (role === "GOOGLER") {
    return [
      { label: "Overview", href: "/google",           icon: "dashboard" },
      { label: "Refer",    href: "/google/leads/new", icon: "sparkles" },
      security,
    ];
  }
  return [];
}

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;
  const nav = primaryNav(role);
  const menu = userMenuItems(role);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="app-header">
      <div className="page-container flex h-14 items-center gap-6">
        {/* Brand */}
        <Logo showBadge={false} size="sm" />

        {/* Primary nav (portal users only) */}
        {session && nav.length > 0 && <SiteNav items={nav} />}

        <div className="flex-1" />

        {/* Right cluster */}
        {!session && (
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm" className="ml-1">
              <Link href="/auth/sign-up">Get started</Link>
            </Button>
          </div>
        )}

        {session?.user && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu
              name={session.user.name ?? session.user.email ?? "Account"}
              email={session.user.email}
              role={role}
              items={menu}
              onSignOut={handleSignOut}
            />
          </div>
        )}
      </div>
    </header>
  );
}
