"use client";

/**
 * Left-rail Saved Views.
 *
 * Renders the user's pinned filter shortcuts, with a "Save current
 * view" affordance when the current URL query has filters that aren't
 * already pinned. Selection navigates by replacing query string —
 * pure URL state, no extra fetch.
 */

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  upsertSavedViewAction,
  deleteSavedViewAction,
} from "@/lib/actions/saved-views";

export interface SavedViewItem {
  id: string;
  label: string;
  query: string;
  pinned: boolean;
  rank: number;
}

export function SavedViewsRail({
  items,
  basePath,
}: {
  items: SavedViewItem[];
  /** Path the saved views apply to, e.g. "/dashboard". */
  basePath: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentQuery = params.toString();
  const [pending, startTransition] = useTransition();

  const matchesCurrent = (view: SavedViewItem) =>
    pathname === basePath && view.query === currentQuery;

  const alreadyPinned = items.some((v) => v.query === currentQuery);

  function saveCurrent() {
    const label = window.prompt(
      "Name this view (e.g. 'Decisions due', 'Stuck > 7d'):",
    );
    if (!label || label.trim().length === 0) return;
    startTransition(async () => {
      const result = await upsertSavedViewAction({
        label: label.trim().slice(0, 60),
        query: currentQuery,
        pinned: true,
      });
      if (result.ok) {
        toast.success("Saved view added");
      } else {
        toast.error("Could not save view.");
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Remove this saved view?")) return;
    startTransition(async () => {
      const result = await deleteSavedViewAction({ id });
      if (result.ok) {
        toast.success("Removed");
      } else {
        toast.error("Could not remove.");
      }
    });
  }

  return (
    <nav className="space-y-1.5" aria-label="Saved views">
      <div className="flex items-center justify-between px-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Saved views
        </div>
      </div>

      <ul className="space-y-0.5">
        {items.length === 0 ? (
          <li className="px-2.5 py-1.5 text-xs text-muted-foreground italic">
            No saved views yet.
          </li>
        ) : (
          items.map((view) => {
            const active = matchesCurrent(view);
            const href = view.query
              ? `${basePath}?${view.query}`
              : basePath;
            return (
              <li key={view.id} className="group flex items-center gap-1">
                <Link
                  href={href}
                  className={cn(
                    "flex-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/80 hover:bg-muted/50",
                  )}
                >
                  <Bookmark className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{view.label}</span>
                </Link>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  aria-label={`Remove ${view.label}`}
                  onClick={() => remove(view.id)}
                  disabled={pending}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })
        )}
      </ul>

      {currentQuery && !alreadyPinned && pathname === basePath && (
        <button
          type="button"
          onClick={saveCurrent}
          disabled={pending}
          className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          Save current view
        </button>
      )}
    </nav>
  );
}
