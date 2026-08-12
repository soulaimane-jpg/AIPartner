"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutGrid,
  FolderKanban,
  FileStack,
  Activity,
  BookOpen,
  TrendingUp,
  Users,
  BarChart3,
  Plus,
  Inbox,
  Trophy,
  UserCircle,
  Network,
  Building2,
  Settings,
  HelpCircle,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Flag,
  KeyRound,
  ShieldCheck,
  ScrollText,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { MarkLogo, Wordmark } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { RailItem, RailIconKey, PortalNav } from "./portal-nav-config";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const ICONS: Record<RailIconKey, LucideIcon> = {
  workspace: LayoutGrid,
  briefs:    FolderKanban,
  proposals: FileStack,
  activity:  Activity,
  templates: BookOpen,
  pipeline:  TrendingUp,
  leads:     Users,
  insights:  BarChart3,
  refer:     Plus,
  inbox:     Inbox,
  won:       Trophy,
  profile:   UserCircle,
  matches:   Network,
  partners:  Building2,
  users:     Users,
  googlers:  Sparkles,
  flags:     Flag,
  developers: KeyRound,
  "sub-processors": ShieldCheck,
  audit:     ScrollText,
  meetings:  CalendarClock,
  settings:  Settings,
  help:      HelpCircle,
};

type Badges = Partial<Record<NonNullable<RailItem["badgeKey"]>, number>>;

/**
 * Flat dark left rail (Linear-style). No aurora, noise, glow, or
 * gradients. Items use a quiet hover wash and the active item gets a
 * subtle background tint — that's it. Brand identity comes from the
 * navy surface and the wordmark, not from effects.
 */
export function PortalRail({
  nav,
  user,
  badges,
  appearance = "default",
  mobileOpen = false,
  onMobileOpenChange,
  onCommand,
}: {
  nav: PortalNav;
  user: { name: string; email: string; image?: string | null; role: string };
  badges?: Badges;
  appearance?: "customer" | "default";
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onCommand?: (action: NonNullable<RailItem["action"]>) => void;
}) {
  const pathname = usePathname();
  const light = appearance === "customer";
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("portal:rail:collapsed");
      if (stored === "1") {
        setCollapsed(true);
        document.documentElement.style.setProperty("--rail-w", "64px");
      } else {
        document.documentElement.style.setProperty("--rail-w", "240px");
      }
    } catch {/* SSR */}
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem("portal:rail:collapsed", next ? "1" : "0"); } catch {}
      document.documentElement.style.setProperty("--rail-w", next ? "64px" : "240px");
      return next;
    });
  }, []);

  const portalHome = getPortalHome(user.role);
  const roleLabel = user.role === "PARTNER" ? "Partner workspace" : user.role === "CUSTOMER" ? "Customer workspace" : user.role;

  const railContent = (mobile = false) => (
    <>
      {/* Brand row */}
      <div className={cn("flex h-14 items-center border-b px-4", light ? "border-slate-200/80" : "border-white/[0.08]")}>
        <Link
          href={portalHome}
          className={cn("inline-flex items-center gap-2.5 rounded outline-none focus-visible:ring-2", light ? "focus-visible:ring-primary/40" : "focus-visible:ring-blue-300/60")}
          aria-label="AI Partner workspace home"
        >
          <MarkLogo size={22} inverse={!light} />
          {(!collapsed || mobile) && <Wordmark size="sm" inverse={!light} />}
        </Link>
        {!mobile && (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-120",
              light ? "text-slate-400 hover:bg-primary/5 hover:text-primary" : "text-white/45 hover:bg-white/[0.07] hover:text-white",
              collapsed && "absolute right-2 top-3 ml-0",
            )}
          >
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Role chip */}
      {(!collapsed || mobile) && user.role && (
        <div className="px-4 pb-1 pt-4">
          <span className={cn("text-[10.5px] font-semibold uppercase tracking-[0.08em]", light ? "text-slate-400" : "text-white/40")}>
            {roleLabel}
          </span>
        </div>
      )}

      {user.role === "CUSTOMER" && (
        <Link
          href="/briefs/new"
          onClick={mobile ? () => onMobileOpenChange?.(false) : undefined}
          title={!mobile && collapsed ? "New brief" : undefined}
          className={cn(
            "mx-2 mt-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground shadow-elev-1 transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-primary/90 hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            !mobile && collapsed && "px-0",
          )}
        >
          <Plus className="h-4 w-4" />
          {(mobile || !collapsed) && <span>New brief</span>}
        </Link>
      )}

      {/* Primary nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3 pt-3">
        {nav.primary.map((item) => (
          <RailLink
            key={item.href + item.label}
            item={item}
            collapsed={mobile ? false : collapsed}
            active={isActive(pathname, item.href)}
            badge={item.badgeKey ? badges?.[item.badgeKey] : undefined}
            light={light}
            onCommand={onCommand}
            onNavigate={mobile ? () => onMobileOpenChange?.(false) : undefined}
          />
        ))}
      </nav>

      {/* Footer cluster */}
      <div className={cn("space-y-px border-t p-2", light ? "border-slate-200/80" : "border-white/[0.06]")}>
        {nav.footer.map((item) => (
          <RailLink
            key={item.href + item.label}
            item={item}
            collapsed={mobile ? false : collapsed}
            active={isActive(pathname, item.href)}
            light={light}
            onCommand={onCommand}
            onNavigate={mobile ? () => onMobileOpenChange?.(false) : undefined}
          />
        ))}

        {/* User chip */}
        <Link
          href="/account"
          onClick={mobile ? () => onMobileOpenChange?.(false) : undefined}
          title={!mobile && collapsed ? user.name || user.email : undefined}
          className={cn(
            "mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors duration-120",
            light ? "hover:bg-primary/5" : "hover:bg-white/[0.04]",
          )}
        >
          <Avatar
            name={user.name || user.email}
            src={user.image}
            size="sm"
            className={light ? "ring-primary/20" : "ring-white/15"}
          />
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[12.5px] font-medium leading-tight", light ? "text-slate-800" : "text-white/85")}>
                {user.name || user.email}
              </div>
              <div className={cn("mt-0.5 truncate text-[11px] leading-tight", light ? "text-slate-400" : "text-white/40")}>
                {user.email}
              </div>
            </div>
          )}
        </Link>
      </div>
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width] duration-200 ease-out lg:flex",
          light
            ? "border-slate-200/80 bg-white text-slate-900 shadow-[8px_0_28px_-26px_hsl(214_70%_34%/0.24)]"
            : "border-white/[0.08] bg-[hsl(var(--cinema-bg))] text-white shadow-[8px_0_28px_-24px_hsl(222_60%_4%/0.8)]",
        )}
        style={{ width: "var(--rail-w, 240px)" }}
        data-collapsed={collapsed ? "true" : "false"}
        data-appearance={appearance}
        aria-label="Primary"
      >
        {railContent()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className={cn(
            "w-[min(88vw,320px)] rounded-none p-0",
            light
              ? "border-slate-200 bg-white text-slate-900"
              : "border-white/[0.07] bg-[hsl(var(--cinema-bg))] text-white",
          )}
        >
          <SheetTitle className="sr-only">Primary navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate the AI Partner platform.
          </SheetDescription>
          <div className="flex h-full flex-col">{railContent(true)}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RailLink({
  item,
  collapsed,
  active,
  badge,
  light,
  onCommand,
  onNavigate,
}: {
  item: RailItem;
  collapsed: boolean;
  active: boolean;
  badge?: number;
  light: boolean;
  onCommand?: (action: NonNullable<RailItem["action"]>) => void;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[item.icon] ?? LayoutGrid;

  const inner = (
    <>
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0",
          light
            ? active ? "text-primary" : "text-slate-400 group-hover:text-primary"
            : active ? "text-white" : "text-white/55",
        )}
      />
      {!collapsed && (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] tracking-tight",
            light
              ? active ? "font-semibold text-slate-900" : "font-medium text-slate-500 group-hover:text-slate-800"
              : active ? "font-medium text-white" : "font-normal text-white/65",
          )}
        >
          {item.label}
        </span>
      )}
      {!collapsed && typeof badge === "number" && badge > 0 && (
        <span className={cn(
          "ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
          light ? "bg-primary/10 text-primary" : "text-white/55",
        )}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );

  const cls = cn(
    "group relative flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none",
    "transition-[background-color,color,box-shadow] duration-160",
    light
      ? active
        ? "bg-primary/5 text-primary shadow-[inset_3px_0_0_hsl(var(--primary))]"
        : "hover:bg-primary/5"
      : active
        ? "bg-blue-500/15 text-white shadow-[inset_3px_0_0_hsl(212_96%_62%)]"
        : "hover:bg-white/[0.06]",
    light ? "focus-visible:ring-2 focus-visible:ring-primary/40" : "focus-visible:ring-2 focus-visible:ring-blue-300/60",
    collapsed && "justify-center",
  );

  if (item.action && onCommand) {
    return (
      <button
        type="button"
        title={collapsed ? item.label : undefined}
        onClick={() => {
          onCommand(item.action!);
          onNavigate?.();
        }}
        className={cls}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className={cls}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
    >
      {inner}
    </Link>
  );
}

function getPortalHome(role: string): string {
  if (role === "PARTNER") return "/partner";
  if (role === "GOOGLER") return "/google";
  if (role === "ADMIN") return "/admin";
  if (role === "COLLABORATOR") return "/collaborations";
  return "/dashboard";
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const cleanHref = href.split("?")[0] || "/";
  if (
    cleanHref === "/" ||
    cleanHref === "/dashboard" ||
    cleanHref === "/google" ||
    cleanHref === "/partner" ||
    cleanHref === "/admin"
  ) {
    return pathname === cleanHref;
  }
  return pathname === cleanHref || pathname.startsWith(cleanHref + "/");
}
