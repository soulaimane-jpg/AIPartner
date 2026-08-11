"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";
import { indicatorSpring } from "@/lib/motion";

export type NavLink = { href: string; label: string };

/**
 * Animated portal navigation.
 *
 * Each link gets an underline indicator that uses Framer's `layoutId` so the
 * indicator slides between active items instead of fading. The pathname is
 * read on the client (this is the only reason the component is "use client"
 * — keeping the parent SiteHeader fully server-rendered for auth state).
 */
export function SiteNav({ items, className }: { items: NavLink[]; className?: string }) {
  const pathname = usePathname() ?? "/";

  // Match exact path or path-prefix for nested routes (e.g. /admin/briefs/123).
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <LayoutGroup id="site-nav">
      <nav className={cn("hidden md:flex items-center gap-1 ml-2", className)}>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium",
                "transition-colors duration-180 ease-out-quart",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              {item.label}
              {active && (
                <m.span
                  layoutId="site-nav-indicator"
                  className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-primary"
                  transition={indicatorSpring}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
