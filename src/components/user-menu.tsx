"use client";

import Link from "next/link";
import {
  LogOut,
  User as UserIcon,
  Settings,
  ChevronDown,
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  UserRound,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* Registry of icons available to menu items. Server components reference
   icons by string key (which IS serializable across the RSC boundary)
   instead of passing the React component itself — lucide-react icons
   are forwardRef objects whose $$typeof Symbol cannot be serialized. */
const ICONS = {
  dashboard: LayoutDashboard,
  folder:    FolderKanban,
  settings:  Settings,
  sparkles:  Sparkles,
  user:      UserRound,
  shield:    Shield,
} as const;
export type UserMenuIconKey = keyof typeof ICONS;

const ROLE_BADGE = {
  ADMIN:    { label: "Admin",    tint: "bg-destructive/10 text-destructive border-destructive/20" },
  CUSTOMER: { label: "Customer", tint: "bg-primary/10 text-primary border-primary/20" },
  PARTNER:  { label: "Partner",  tint: "bg-accent-violet/10 text-accent-violet border-accent-violet/25" },
  GOOGLER:  { label: "Googler",  tint: "bg-accent-teal/10 text-accent-teal border-accent-teal/25" },
} as const;

type Role = keyof typeof ROLE_BADGE;

export type UserMenuItem = {
  label: string;
  href: string;
  icon?: UserMenuIconKey;
};

/**
 * Avatar trigger + dropdown for the signed-in user. Replaces the bare
 * sign-out icon button. The actual sign-out remains a server action — we
 * just expose it via a form-wrapped item so the menu doesn't depend on
 * client-side auth state.
 */
export function UserMenu({
  name,
  email,
  role,
  items,
  onSignOut,
}: {
  name: string;
  email?: string | null;
  role?: Role | string | null;
  items?: UserMenuItem[];
  /** Server action that signs the user out and redirects. */
  onSignOut: () => Promise<void>;
}) {
  const roleKey = (role && (role in ROLE_BADGE) ? (role as Role) : null);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-2 py-1",
          "text-[13px] font-medium text-foreground",
          "transition-[box-shadow,border-color,background-color] duration-180 ease-out-quart",
          "shadow-elev-1 hover:shadow-elev-2 hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent-violet))_100%)] text-[11px] font-semibold text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.18)]"
        >
          {initials}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-180 ease-out-quart group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10}>
        <DropdownMenuLabel className="!normal-case !tracking-normal !text-foreground !font-medium !text-[13px] !py-2">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent-violet))_100%)] text-[12px] font-semibold text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.2)]"
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">
                {name}
              </div>
              {email && (
                <div className="truncate text-[11.5px] font-normal text-muted-foreground">
                  {email}
                </div>
              )}
            </div>
            {roleKey && (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  ROLE_BADGE[roleKey].tint,
                )}
              >
                {ROLE_BADGE[roleKey].label}
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        {items && items.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {items.map(({ label, href, icon }) => {
              const Icon = icon ? ICONS[icon] : UserIcon;
              return (
                <DropdownMenuItem key={href} asChild>
                  <Link href={href}>
                    <Icon />
                    {label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />
        <form action={onSignOut}>
          <button
            type="submit"
            className="flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-destructive outline-none transition-colors duration-120 ease-out-quart hover:bg-destructive/10 focus:bg-destructive/10 [&_svg]:size-4 [&_svg]:text-destructive"
          >
            <LogOut />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
