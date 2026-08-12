"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { PortalRail } from "./portal-rail";
import { PortalTopBar } from "./portal-topbar";
import { CommandPalette } from "./command-palette";
import type { PortalNav, RailItem } from "./portal-nav-config";
import {
  PortalBreadcrumbProvider,
  type PortalCrumb,
} from "./portal-breadcrumb-context";

/**
 * Client-side coordinator for the portal chrome.
 *
 * Owns:
 *   • Rail + topbar rendering
 *   • Command palette state + global ⌘K / ⌘N shortcuts
 *   • Route transition wrapper (fade + 6px slide)
 *   • Global toaster
 */
export function PortalShellClient({
  nav,
  user,
  badges,
  notifications,
  notificationsCount,
  signOut,
  children,
}: {
  nav: PortalNav;
  user: { name: string; email: string; image?: string | null; role: string };
  badges?: Record<string, number>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: string;
  }>;
  notificationsCount: number;
  signOut: () => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [routeCrumbs, setRouteCrumbs] = useState<PortalCrumb[] | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMobileNavOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  // Global ⌘K / Ctrl+K to toggle palette, ⌘N role-aware quick action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (key === "n") {
        e.preventDefault();
        if (user.role === "CUSTOMER") {
          router.push("/briefs/new");
        } else if (user.role === "GOOGLER") {
          router.push("/google/leads/new");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, user.role]);

  const handleRailCommand = useCallback(
    (action: NonNullable<RailItem["action"]>) => {
      if (action === "command-palette") {
        setPaletteOpen(true);
      } else if (action === "refer-customer") {
        router.push("/google/leads/new");
      }
    },
    [router],
  );

  const handlePaletteAction = useCallback(
    (action: "refer-customer" | "new-brief") => {
      if (action === "refer-customer") router.push("/google/leads/new");
      if (action === "new-brief") router.push("/briefs/new");
    },
    [router],
  );

  const appearance = "platform" as const;

  return (
    <div className="portal-root min-h-screen" data-portal-appearance={appearance}>
      <a
        href="#portal-main"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-elev-3 transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <PortalRail
        nav={nav}
        user={user}
        badges={badges as never}
        appearance={appearance}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
        onCommand={handleRailCommand}
      />

      {/* Content area — offset by the rail width via the --rail-w CSS var */}
      <div className="portal-content flex min-h-screen flex-col bg-background">
        <PortalTopBar
          user={user}
          crumbs={routeCrumbs ?? undefined}
          appearance={appearance}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          notifications={notifications}
          notificationsOpen={notificationsOpen}
          onNotificationsOpenChange={setNotificationsOpen}
          notificationsCount={notificationsCount}
          accountHref="/account"
          onSignOut={signOut}
        />
        <main id="portal-main" tabIndex={-1} className="min-h-[calc(100vh-var(--topbar-h,60px))] flex-1 bg-background outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={pathname}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <PortalBreadcrumbProvider setCrumbs={setRouteCrumbs}>
                {children}
              </PortalBreadcrumbProvider>
            </m.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={user.role}
        onAction={handlePaletteAction}
      />

      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            "!rounded-[14px] !border !border-border !bg-card !text-foreground !shadow-[var(--elev-2)] !font-ui",
        }}
      />
    </div>
  );
}
