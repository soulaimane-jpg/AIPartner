"use client";

/**
 * Active sessions list with per-row revoke + global "sign out everywhere".
 *
 * The current device isn't distinguishable from server data alone — we
 * show a generic list. Once we want to highlight "this device", we'll
 * thread the current `tokenHash` from the layout.
 */

import { useTransition } from "react";
import { Globe, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  revokeSessionAction,
  revokeAllSessionsAction,
} from "@/lib/actions/auth-mfa";

interface SessionRow {
  id: string;
  ipHash: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  mfaVerifiedAt: Date | null;
  lastSeenAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [pending, startTransition] = useTransition();

  function revoke(sessionId: string) {
    if (!window.confirm("Sign this device out?")) return;
    startTransition(async () => {
      const result = await revokeSessionAction({ sessionId });
      if (!result.ok) {
        toast.error("Could not revoke session.");
        return;
      }
      toast.success("Session revoked");
    });
  }

  function revokeAll() {
    if (
      !window.confirm(
        "Sign out of every device? You'll need to sign in again on each one.",
      )
    )
      return;
    startTransition(async () => {
      const result = await revokeAllSessionsAction({});
      if (!result.ok) {
        toast.error("Could not revoke all sessions.");
        return;
      }
      toast.success(`Revoked ${result.data.revoked} session(s)`);
    });
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No active sessions found.
      </p>
    );
  }

  return (
    <div className="space-y-2" aria-busy={pending || undefined}>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-col items-stretch justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                {s.deviceLabel ?? "Unknown device"}
                {s.mfaVerifiedAt && (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-success font-normal"
                    title={`MFA verified ${fmt(s.mfaVerifiedAt)}`}
                  >
                    <ShieldCheck className="h-3 w-3" /> MFA
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Last seen {fmt(s.lastSeenAt)} · expires {fmt(s.expiresAt)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => revoke(s.id)}
              className="w-full sm:w-auto"
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>

      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={revokeAll}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
