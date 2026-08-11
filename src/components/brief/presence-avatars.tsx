"use client";

/**
 * Live-presence avatars for a brief workspace.
 *
 * On mount, fires `markPresenceAction` once (self-register) and starts
 * a 10s heartbeat. Every 8s also re-fetches the presence list via the
 * server route `/api/brief/[id]/presence`. Stops everything on unmount.
 *
 * Renders up to 3 stacked avatars + a `+N` overflow chip. Avatars are
 * deterministic gradient discs keyed by initials — no profile pictures
 * required.
 *
 * Why polling, not WebSockets:
 *   - the design goal is "you're not alone in here", not "see every
 *     keystroke";
 *   - polling is one less moving part (no Pusher / Liveblocks bill);
 *   - if/when we need realtime, swapping in Supabase Realtime is local
 *     to this file + `/api/brief/[id]/presence`.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { markPresenceAction } from "@/lib/actions/presence";

export type PresenceUser = {
  id: string;
  name: string | null;
  email: string;
  activity: "viewing" | "editing" | "commenting";
};

function initials(s: string): string {
  return (
    s
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·"
  );
}

export function PresenceAvatars({
  briefId,
  initial,
  selfUserId,
}: {
  briefId: string;
  initial: PresenceUser[];
  selfUserId: string;
}) {
  const [users, setUsers] = useState<PresenceUser[]>(initial);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function heartbeat() {
      try {
        await markPresenceAction({ briefId });
      } catch {
        // best-effort — never noisy
      }
    }

    async function refresh() {
      try {
        const res = await fetch(`/api/brief/${briefId}/presence`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { users: PresenceUser[] };
        if (!cancelled) setUsers(data.users ?? []);
      } catch {
        // network blip — keep current list
      }
    }

    void heartbeat();
    timer = setInterval(() => {
      void heartbeat();
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [briefId]);

  const visible = users.filter((u) => u.id !== selfUserId).slice(0, 3);
  const overflow = Math.max(0, users.filter((u) => u.id !== selfUserId).length - 3);

  if (visible.length === 0 && overflow === 0) return null;

  return (
    <div
      className="flex -space-x-1.5 items-center"
      aria-label={`${visible.length + overflow} other people viewing`}
    >
      {visible.map((u) => (
        <span
          key={u.id}
          title={`${u.name ?? u.email} · ${u.activity}`}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white",
            "border-2 border-card",
            "bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent-violet))_100%)]",
          )}
        >
          {initials(u.name ?? u.email)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="grid h-7 px-2 place-items-center rounded-full text-[10px] font-semibold border-2 border-card bg-muted text-foreground"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
