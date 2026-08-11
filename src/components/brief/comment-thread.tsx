"use client";

/**
 * Comment thread — top-level comment + replies inside a section.
 *
 * The parent section component renders one `<CommentThread>` per
 * top-level comment. Replies are passed in already grouped — we don't
 * fetch from the client.
 *
 * Resolved threads collapse to a one-line summary that can be expanded.
 */

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Reply,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  replyToCommentAction,
  resolveCommentAction,
  deleteCommentAction,
} from "@/lib/actions/comments";
import { cn } from "@/lib/utils";

export interface CommentRow {
  id: string;
  body: string;
  author: { id: string; name: string | null; email: string };
  createdAt: Date;
  resolvedAt: Date | null;
  parentId: string | null;
}

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  return `${day}d`;
}

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

export function CommentThread({
  parent,
  replies,
  currentUserId,
  briefOwnerId,
}: {
  parent: CommentRow;
  replies: CommentRow[];
  currentUserId: string;
  briefOwnerId: string;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [expanded, setExpanded] = useState(parent.resolvedAt == null);
  const [pending, startTransition] = useTransition();
  const isResolved = parent.resolvedAt != null;
  const canModerate =
    currentUserId === parent.author.id || currentUserId === briefOwnerId;

  function submitReply() {
    if (replyText.trim().length === 0) return;
    startTransition(async () => {
      const result = await replyToCommentAction({
        parentId: parent.id,
        body: replyText.trim(),
      });
      if (result.ok) {
        setReplyText("");
        setReplyOpen(false);
        toast.success("Reply added");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not reply",
        );
      }
    });
  }

  function toggleResolve() {
    startTransition(async () => {
      const result = await resolveCommentAction({
        id: parent.id,
        resolved: !isResolved,
      });
      if (result.ok) {
        toast.success(isResolved ? "Re-opened" : "Resolved");
      } else {
        toast.error("Could not update");
      }
    });
  }

  function deleteParent() {
    if (!window.confirm("Delete this thread?")) return;
    startTransition(async () => {
      const result = await deleteCommentAction({ id: parent.id });
      if (result.ok) {
        toast.success("Deleted");
      } else {
        toast.error("Could not delete");
      }
    });
  }

  if (isResolved && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="truncate">
          Resolved · {parent.body.slice(0, 80)}
        </span>
        <ChevronDown className="h-3 w-3 ml-auto" />
      </button>
    );
  }

  return (
    <div
      id={`comment-${parent.id}`}
      className={cn(
        "rounded-xl border p-3 space-y-3 bg-card",
        isResolved ? "border-emerald-200/60" : "border-border",
      )}
    >
      <CommentRowView comment={parent} />

      {replies.length > 0 && (
        <ul className="space-y-2 pl-6 border-l border-border">
          {replies.map((r) => (
            <li key={r.id}>
              <CommentRowView comment={r} compact />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pl-6">
        {!isResolved && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplyOpen((v) => !v)}
            disabled={pending}
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>
        )}
        {canModerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleResolve}
            disabled={pending}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isResolved ? "Re-open" : "Resolve"}
          </Button>
        )}
        {canModerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteParent}
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      {replyOpen && (
        <div className="pl-6 space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply…"
            rows={2}
            maxLength={4000}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submitReply} disabled={pending}>
              {pending ? "Sending…" : "Reply"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentRowView({
  comment,
  compact = false,
}: {
  comment: CommentRow;
  compact?: boolean;
}) {
  const name = comment.author.name ?? comment.author.email;
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden
        className={cn(
          "shrink-0 grid place-items-center rounded-full font-semibold text-white",
          "bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent-violet))_100%)]",
          compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]",
        )}
      >
        {initials(name)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={cn("font-medium", compact ? "text-[12px]" : "text-[13px]")}>
            {name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(comment.createdAt)} ago
          </span>
        </div>
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            compact ? "text-[12.5px]" : "text-[13px]",
          )}
        >
          {comment.body}
        </p>
      </div>
    </div>
  );
}
