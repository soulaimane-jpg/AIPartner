"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Search, Bell, Command as CommandIcon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Crumb = { label: string; href?: string };

/**
 * Slim white top bar mounted by `<PortalShell />`. Shows breadcrumbs on
 * the left, a centred search/⌘K trigger, and a notifications + avatar
 * cluster on the right.
 *
 * The breadcrumbs are computed from the current pathname using a small
 * router map; pages can override by providing `crumbs` directly.
 */
export function PortalTopBar({
  crumbs,
  user,
  appearance = "default",
  onOpenMobileNav,
  onOpenPalette,
  notifications,
  notificationsOpen,
  onNotificationsOpenChange,
  notificationsCount = 0,
  accountHref = "/account",
  onSignOut,
}: {
  crumbs?: Crumb[];
  user: { name: string; email: string; image?: string | null; role: string };
  appearance?: "customer" | "default";
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: string;
  }>;
  notificationsOpen: boolean;
  onNotificationsOpenChange: (open: boolean) => void;
  notificationsCount?: number;
  accountHref?: string;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const trail = crumbs ?? autoCrumbs(pathname);
  const light = appearance === "customer";

  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
    setShortcut(isMac ? "⌘ K" : "Ctrl K");
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-3 backdrop-blur-md sm:px-5",
        light
          ? "border-indigo-100/80 bg-white/90 shadow-[0_8px_24px_-24px_hsl(245_82%_42%/0.34)]"
          : "border-border/90 bg-card/95 shadow-[0_1px_0_hsl(var(--line)/0.7)]",
      )}
      data-appearance={appearance}
    >
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-120 hover:bg-secondary hover:text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 min-w-0 sm:flex">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <span
              key={`${c.label}-${i}`}
              className={cn("min-w-0 items-center gap-1.5", i < trail.length - 2 ? "hidden md:inline-flex" : "inline-flex")}
            >
              {i > 0 && <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground/55 md:block" />}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate rounded px-1 -mx-1 text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  {c.label}
                </Link>
              ) : (
                <span className={cn("truncate text-[13px]", last ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          "hidden md:inline-flex items-center gap-2 h-8 px-2.5 rounded-md",
          "border border-border bg-surface-sunk text-muted-foreground shadow-elev-1",
          "hover:border-border-strong hover:bg-card hover:text-foreground",
          "transition-colors duration-120",
          "min-w-[240px] text-left",
        )}
        aria-label="Search"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-[12.5px] flex-1">Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded text-muted-foreground/70">
          {shortcut}
        </kbd>
      </button>

      {/* Mobile palette icon */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="md:hidden grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors duration-120"
        aria-label="Search"
      >
        <CommandIcon className="h-4 w-4" />
      </button>

      {/* Notifications */}
      <DropdownMenu open={notificationsOpen} onOpenChange={onNotificationsOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors duration-120 hover:bg-secondary hover:text-foreground"
            aria-label={`Notifications${notificationsCount > 0 ? ` (${notificationsCount} unread)` : ""}`}
          >
            <Bell className="h-4 w-4" />
            {notificationsCount > 0 && (
              <span
                aria-hidden
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
              />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-0">
          <DropdownMenuLabel className="flex items-center justify-between !normal-case !tracking-normal !px-4 !py-3">
            <span className="text-[13px] font-semibold text-foreground">Notifications</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {notificationsCount} unread
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="max-h-[min(26rem,70vh)] overflow-y-auto p-1.5">
              {notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} asChild className="items-start p-0">
                  <Link
                    href={notification.link || "#"}
                    className="flex w-full gap-3 rounded-lg px-3 py-2.5"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        notification.read ? "bg-border-strong" : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold leading-snug text-foreground">
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[10.5px] text-muted-foreground/75">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-full",
            "bg-secondary text-foreground",
            "hover:bg-secondary/80",
            "transition-colors duration-120",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
          )}
          aria-label="Account menu"
        >
          <Avatar name={user.name || user.email} src={user.image} size="md" className="h-8 w-8" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-60">
          <DropdownMenuLabel className="!normal-case !tracking-normal !text-foreground !font-medium !text-[13px] !py-2">
            <div className="space-y-0.5">
              <div className="font-semibold truncate">{user.name || "Account"}</div>
              <div className="text-[11.5px] text-muted-foreground truncate">{user.email}</div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={accountHref}>Account</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onSignOut();
            }}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/* ─── Auto‑breadcrumbs ──────────────────────────────────────── */

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  briefs: "Briefs",
  proposals: "Proposals",
  builder: "Builder",
  preview: "Preview",
  edit: "Edit",
  google: "Google · Pipeline",
  leads: "Leads",
  new: "New",
  partner: "Partner workspace",
  opportunities: "Opportunities",
  pipeline: "Pipeline",
  won: "Won",
  profile: "Company profile",
  admin: "Admin",
  matches: "Matches",
  partners: "Partners",
  users: "Users",
  insights: "Insights",
  onboarding: "Onboarding",
  account: "Account",
  security: "Security",
  compare: "Compare",
  shortlist: "Shortlist",
  clarifications: "Clarifications",
  "review-call": "Review call",
  "new-call": "Book a call",
};

function autoCrumbs(pathname: string | null): Crumb[] {
  if (!pathname) return [];
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "Home" }];

  const crumbs: Crumb[] = [];
  let acc = "";
  for (let i = 0; i < segs.length; i++) {
    acc += "/" + segs[i];
    const last = i === segs.length - 1;
    const dynamicId = isOpaqueId(segs[i]);
    if (dynamicId) continue;
    const label = ROUTE_LABELS[segs[i]] ?? prettify(segs[i]);
    crumbs.push({ label, href: last ? undefined : acc });
  }
  return crumbs;
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function isOpaqueId(segment: string): boolean {
  return /^[a-z0-9_-]{16,}$/i.test(segment) && /\d/.test(segment);
}

function prettify(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
