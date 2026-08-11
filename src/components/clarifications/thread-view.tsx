"use client";

/**
 * M9 — shared clarification-thread UI. Used by company, partner and
 * admin surfaces. Identity discipline: this component renders ONLY
 * the `authorLabel` strings the server page computed for the current
 * audience (e.g. "Partner A", "The AIPartner team") — it never
 * receives raw names from the other side of the firewall.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  MessageSquare,
  Phone,
  CheckCircle2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  replyClarificationAction,
  resolveClarificationAction,
} from "@/lib/actions/clarifications";
import { mapErrorToToast } from "@/lib/schemas/errors";
import { cn } from "@/lib/utils";

export interface ThreadMessageDTO {
  id: string;
  authorLabel: string;
  mine: boolean;
  kind: string;
  body: string;
  slots: { startsAt: string; durationMins: number }[];
  chosenSlot: string | null;
  createdAt: string;
}

export interface ThreadDTO {
  id: string;
  contextType: string;
  anchorSectionKey: string | null;
  status: string;
  resolution: string | null;
  messages: ThreadMessageDTO[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  awaiting_company: "Waiting on customer",
  awaiting_partner: "Waiting on partner",
  awaiting_admin: "Waiting on AIPartner team",
  resolved: "Resolved",
};

export function ClarificationThreadView({
  thread,
  briefId,
  matchId,
  canResolve,
}: {
  thread: ThreadDTO;
  briefId: string;
  matchId?: string;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [showCall, setShowCall] = React.useState(false);
  const [slots, setSlots] = React.useState<string[]>([""]);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const resolved = thread.status === "resolved";

  const send = (kind: "text" | "call_proposal") => {
    setError(null);
    startTransition(async () => {
      const result = await replyClarificationAction({
        threadId: thread.id,
        briefId,
        matchId,
        kind,
        body:
          kind === "call_proposal" && !body.trim()
            ? "Proposed call times:"
            : body,
        slots:
          kind === "call_proposal"
            ? slots
                .filter(Boolean)
                .map((s) => ({ startsAt: s, durationMins: 30 }))
            : [],
      });
      if (result.ok) {
        setBody("");
        setSlots([""]);
        setShowCall(false);
        router.refresh();
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  const confirmSlot = (iso: string) => {
    setError(null);
    startTransition(async () => {
      const result = await replyClarificationAction({
        threadId: thread.id,
        briefId,
        matchId,
        kind: "call_confirmed",
        body: `Confirmed call slot: ${new Date(iso).toLocaleString()}`,
        chosenSlot: iso,
      });
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error));
    });
  };

  const resolve = (resolution: "message" | "call") => {
    setError(null);
    startTransition(async () => {
      const result = await resolveClarificationAction({
        threadId: thread.id,
        briefId,
        resolution,
      });
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error));
    });
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <header className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12.5px] font-medium text-foreground">
          {thread.anchorSectionKey
            ? `On section: ${thread.anchorSectionKey.replace(/_/g, " ")}`
            : "General clarification"}
        </span>
        <Badge
          variant={resolved ? "success" : "outline"}
          className="ml-auto text-[10px] uppercase tracking-wider"
        >
          {STATUS_LABELS[thread.status] ?? thread.status}
        </Badge>
      </header>

      <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}
          >
            <span className="text-[11px] text-muted-foreground mb-0.5">
              {m.authorLabel} ·{" "}
              {new Date(m.createdAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-[13px] leading-relaxed max-w-[85%] whitespace-pre-wrap",
                m.mine
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground",
              )}
            >
              {m.body}
              {m.kind === "call_proposal" && m.slots.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.slots.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={pending || resolved || m.mine}
                      onClick={() => confirmSlot(s.startsAt)}
                      className={cn(
                        "block w-full rounded border px-2 py-1 text-[12px] text-left",
                        m.mine
                          ? "border-background/30"
                          : "border-border bg-background hover:bg-secondary/60",
                      )}
                    >
                      <Phone className="inline h-3 w-3 mr-1.5" />
                      {new Date(s.startsAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {s.durationMins} min
                    </button>
                  ))}
                </div>
              )}
              {m.kind === "call_confirmed" && (
                <span className="mt-1 flex items-center gap-1 text-[12px]">
                  <CheckCircle2 className="h-3 w-3" /> Call confirmed
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="px-4 pb-2 text-[12.5px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {!resolved && (
        <footer className="px-4 py-3 border-t border-border space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a reply…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-ring"
          />
          {showCall && (
            <div className="space-y-1.5">
              {slots.map((s, i) => (
                <input
                  key={i}
                  type="datetime-local"
                  value={s}
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
                />
              ))}
              {slots.length < 5 && (
                <button
                  type="button"
                  onClick={() => setSlots((prev) => [...prev, ""])}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  + another slot
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={pending || (!showCall && !body.trim())}
              onClick={() => send(showCall ? "call_proposal" : "text")}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {showCall ? "Propose call times" : "Send"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCall((v) => !v)}
              disabled={pending}
            >
              <Phone className="h-3.5 w-3.5" />
              {showCall ? "Cancel call" : "Suggest a call"}
            </Button>
            {canResolve && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={pending}
                onClick={() => resolve("message")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
