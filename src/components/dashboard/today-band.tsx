/**
 * Today band — the digest pill row pinned above the workspace.
 *
 * Three numeric tiles ("X new proposals", "Y decisions due", "Z unread
 * comments") computed server-side for the current user. Each tile is
 * a link into a pre-filtered view.
 *
 * Pure RSC — no client JS. The pills use editorial typography (numbers
 * in mono) and the same hairline border treatment as `Stat` so the band
 * sits inside the Paper v5 surface without screaming.
 */

import Link from "next/link";
import { Bell, Hourglass, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TodayBandCounts {
  /** Proposals submitted since the user's last visit. */
  newProposals: number;
  /** Briefs needing a decision from this user. */
  decisionsDue: number;
  /** Unread inline comments across briefs the user owns. */
  unreadComments: number;
}

interface Tile {
  label: string;
  count: number;
  icon: typeof Bell;
  href: string;
  /** Tailwind class for the icon foreground. */
  tone: string;
}

export function TodayBand({
  counts,
}: {
  counts: TodayBandCounts;
}) {
  const tiles: Tile[] = [
    {
      label: "New proposals",
      count: counts.newProposals,
      icon: Bell,
      href: "/dashboard?view=proposals",
      tone: "text-primary",
    },
    {
      label: "Decisions due",
      count: counts.decisionsDue,
      icon: Hourglass,
      href: "/dashboard?stage=REVIEW",
      tone: "text-amber-600",
    },
    {
      label: "Unread comments",
      count: counts.unreadComments,
      icon: MessageSquare,
      href: "/dashboard?view=comments",
      tone: "text-accent-violet",
    },
  ];

  const total = tiles.reduce((acc, t) => acc + t.count, 0);
  if (total === 0) {
    return null; // Calm-by-default: don't show an all-zeros band.
  }

  return (
    <aside
      aria-label="Today's updates"
      className="rounded-2xl border border-line bg-card/60 px-4 py-3 grid gap-3 sm:grid-cols-3"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Link
            key={tile.label}
            href={tile.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2",
              "transition-colors duration-150 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                "bg-secondary/60",
              )}
            >
              <Icon className={cn("h-4 w-4", tile.tone)} />
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[18px] font-semibold tabular-nums leading-none">
                {tile.count}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {tile.label}
              </div>
            </div>
          </Link>
        );
      })}
    </aside>
  );
}
