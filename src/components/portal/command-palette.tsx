"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  Search,
  ArrowRight,
  LayoutGrid,
  FolderKanban,
  FileStack,
  Inbox,
  TrendingUp,
  Users,
  Plus,
  Settings,
  UserPlus,
  Sparkles,
  Activity,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import type { PortalRole } from "./portal-nav-config";

export type PaletteEntry = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Actions" | "Recent" | "Switch view";
  icon?: LucideIcon;
  /** Either a route to push or an action key. */
  href?: string;
  action?: "refer-customer" | "new-brief";
};

/**
 * Portal command palette (`⌘K` / `Ctrl K`).
 *
 * Mounts a Radix Dialog overlay containing a `cmdk` instance, populated
 * with role‑aware Navigate / Action / Recent / Switch view groups.
 *
 * The palette is opened/closed via `open` + `onOpenChange` props (so the
 * `<PortalShell />` owns the keyboard listener and any side‑sheets the
 * palette triggers).
 */
export function CommandPalette({
  open,
  onOpenChange,
  role,
  recents = [],
  onAction,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  role: PortalRole | string | undefined;
  /** Recently visited items (briefs/leads). Pages can feed this list. */
  recents?: Array<{ id: string; label: string; href: string; group?: "Brief" | "Lead" | "Partner" }>;
  /** Action handler for entries that don't navigate. */
  onAction?: (action: NonNullable<PaletteEntry["action"]>) => void;
}) {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      // Defer to next tick so the dialog close animation can begin smoothly.
      setTimeout(() => router.push(href), 60);
    },
    [router, onOpenChange],
  );

  const runAction = useCallback(
    (action: NonNullable<PaletteEntry["action"]>) => {
      onOpenChange(false);
      setTimeout(() => onAction?.(action), 60);
    },
    [onAction, onOpenChange],
  );

  const entries = buildEntries(role, recents);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-[hsl(var(--foreground)/0.35)] backdrop-blur-[3px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-180 data-[state=closed]:duration-120",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[18%] z-50 w-full max-w-[640px] -translate-x-[50%]",
            "bg-card border border-border rounded-[16px] shadow-[var(--elev-3)] overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:duration-180 data-[state=closed]:duration-120",
          )}
          onOpenAutoFocus={(e) => {
            // Let cmdk own the focused element (the input).
            e.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search and run commands across the AI Partner workspace.
          </DialogPrimitive.Description>

          <Command
            label="Command palette"
            className="relative"
            filter={(value, search) => {
              if (!search) return 1;
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border bg-surface-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
              <Command.Input
                autoFocus
                placeholder="Search briefs, partners, actions…"
                className="flex-1 bg-transparent outline-none text-[14.5px] text-foreground placeholder:text-muted-foreground font-ui"
              />
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-card text-muted-foreground">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[400px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                No matches.
              </Command.Empty>

              {(["Recent", "Navigate", "Actions", "Switch view"] as const).map((group) => {
                const items = entries.filter((e) => e.group === group);
                if (items.length === 0) return null;
                return (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="
                      [&_[cmdk-group-heading]]:px-3
                      [&_[cmdk-group-heading]]:py-2
                      [&_[cmdk-group-heading]]:text-[10.5px]
                      [&_[cmdk-group-heading]]:uppercase
                      [&_[cmdk-group-heading]]:tracking-[0.12em]
                      [&_[cmdk-group-heading]]:text-muted-foreground
                      [&_[cmdk-group-heading]]:font-medium
                      [&_[cmdk-group-heading]]:font-mono
                    "
                  >
                    {items.map((entry) => {
                      const Icon = entry.icon ?? ArrowRight;
                      return (
                        <Command.Item
                          key={entry.id}
                          value={`${entry.label} ${entry.hint ?? ""}`}
                          onSelect={() => {
                            if (entry.href) navigate(entry.href);
                            else if (entry.action) runAction(entry.action);
                          }}
                          className="
                            flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                            text-[13.5px] text-foreground transition-colors
                            data-[selected=true]:bg-[hsl(var(--accent-soft)/0.6)]
                            data-[selected=true]:text-[hsl(var(--accent-ink))]
                          "
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{entry.label}</span>
                          {entry.hint && (
                            <span className="text-[10.5px] font-mono text-muted-foreground bg-secondary/60 border border-border px-1.5 py-0.5 rounded">
                              {entry.hint}
                            </span>
                          )}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                );
              })}
            </Command.List>

            <div className="flex items-center justify-between px-4 h-10 border-t border-border bg-surface-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 font-mono">
                <span>↑↓</span><span>navigate</span>
                <span className="opacity-40 mx-1">·</span>
                <span>↵</span><span>select</span>
              </div>
              <div className="font-mono">esc to close</div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function buildEntries(
  role: PortalRole | string | undefined,
  recents: Array<{ id: string; label: string; href: string; group?: "Brief" | "Lead" | "Partner" }>,
): PaletteEntry[] {
  const list: PaletteEntry[] = [];

  // Recents
  for (const r of recents.slice(0, 6)) {
    list.push({
      id: `recent:${r.id}`,
      label: r.label,
      hint: r.group ?? "Recent",
      group: "Recent",
      icon: Sparkles,
      href: r.href,
    });
  }

  // Navigate (role‑aware)
  if (role === "CUSTOMER") {
    list.push(
      { id: "nav:dashboard",  label: "Workspace",  group: "Navigate", icon: LayoutGrid,    href: "/dashboard" },
      { id: "nav:briefs",     label: "Briefs",     group: "Navigate", icon: FolderKanban,  href: "/dashboard?view=board" },
      { id: "nav:proposals",  label: "Proposals",  group: "Navigate", icon: FileStack,     href: "/dashboard?view=proposals" },
      { id: "nav:activity",   label: "Activity",   group: "Navigate", icon: Activity,      href: "/dashboard?view=activity" },
      { id: "nav:profile",    label: "Profile",    group: "Navigate", icon: Settings,      href: "/account" },
    );
    list.push(
      { id: "act:new-brief",  label: "New brief",  group: "Actions",  icon: Plus, hint: "⌘ N", action: "new-brief" },
    );
    list.push(
      { id: "view:board",  label: "Switch to Board view",    group: "Switch view", icon: LayoutGrid,   href: "/dashboard?view=board" },
      { id: "view:list",   label: "Switch to List view",     group: "Switch view", icon: ArrowRight,   href: "/dashboard?view=list" },
      { id: "view:cal",    label: "Switch to Calendar view", group: "Switch view", icon: ArrowRight,   href: "/dashboard?view=calendar" },
    );
  }
  if (role === "GOOGLER") {
    list.push(
      { id: "nav:pipeline", label: "Pipeline",  group: "Navigate", icon: TrendingUp, href: "/google" },
      { id: "nav:leads",    label: "Leads",     group: "Navigate", icon: Users,      href: "/google/leads" },
      { id: "nav:insights", label: "Insights",  group: "Navigate", icon: Sparkles,   href: "/google/insights" },
    );
    list.push(
      { id: "act:refer", label: "Refer customer", group: "Actions", icon: UserPlus, hint: "⌘ N", action: "refer-customer" },
    );
  }
  if (role === "PARTNER") {
    list.push(
      { id: "nav:partner-overview", label: "Partner overview", group: "Navigate", icon: LayoutGrid, href: "/partner" },
      { id: "nav:opportunities", label: "Opportunities", group: "Navigate", icon: Inbox, href: "/partner/opportunities" },
      { id: "nav:pipeline", label: "Pipeline", group: "Navigate", icon: TrendingUp, href: "/partner/pipeline" },
      { id: "nav:won", label: "Won engagements", group: "Navigate", icon: Trophy, href: "/partner/won" },
      { id: "nav:profile", label: "Company profile", group: "Navigate", icon: Settings, href: "/partner/profile" },
    );
  }
  if (role === "ADMIN") {
    list.push(
      { id: "nav:admin",    label: "Admin overview", group: "Navigate", icon: LayoutGrid,   href: "/admin" },
      { id: "nav:abriefs",  label: "All briefs",     group: "Navigate", icon: FolderKanban, href: "/admin/briefs" },
      { id: "nav:apartners",label: "Partners",       group: "Navigate", icon: Users,        href: "/admin/partners" },
    );
  }

  return list;
}
