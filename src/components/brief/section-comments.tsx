"use client";

/**
 * Section-level comment panel — drop one of these next to each brief
 * section on the preview page. Renders all threads anchored to a key,
 * plus a composer for new top-level comments.
 *
 * Replies are grouped client-side from the flat list provided by the
 * parent server component (no extra fetch).
 */

import { useMemo, useState, useTransition } from "react";
import { MessageSquarePlus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createCommentAction } from "@/lib/actions/comments";
import { CommentThread, type CommentRow } from "./comment-thread";

const SECTION_LABELS: Record<string, string> = {
  executiveSummary: "Executive summary",
  scopeRequirements: "Scope requirements",
  integrationPoints: "Integration points",
  dataSources: "Data sources",
  successCriteria: "Success criteria",
  targetGoLive: "Target go-live",
  budgetRange: "Budget",
  preferredLocation: "Preferred location",
  requiredCertifications: "Required certifications",
  reviewWorkflow: "Review workflow",
  meeting: "Meeting",
  general: "General",
};

export function SectionComments({
  briefId,
  sectionKey,
  comments,
  currentUserId,
  briefOwnerId,
}: {
  briefId: string;
  sectionKey: string;
  comments: CommentRow[];
  currentUserId: string;
  briefOwnerId: string;
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const threads = useMemo(() => {
    const top = comments.filter((c) => !c.parentId);
    const byParent = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      }
    }
    return top.map((parent) => ({
      parent,
      replies: byParent.get(parent.id) ?? [],
    }));
  }, [comments]);

  const unresolved = threads.filter((t) => !t.parent.resolvedAt).length;

  function submit() {
    if (body.trim().length === 0) return;
    startTransition(async () => {
      const result = await createCommentAction({
        briefId,
        sectionKey,
        body: body.trim(),
      });
      if (result.ok) {
        toast.success("Comment added");
        setBody("");
        setComposerOpen(false);
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not comment",
        );
      }
    });
  }

  return (
    <section
      aria-label={`Comments on ${SECTION_LABELS[sectionKey] ?? sectionKey}`}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {SECTION_LABELS[sectionKey] ?? sectionKey}
          {unresolved > 0 && (
            <span className="font-mono tabular-nums text-primary">
              · {unresolved}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setComposerOpen((v) => !v)}
          disabled={pending}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Comment
        </Button>
      </div>

      {composerOpen && (
        <div className="space-y-2 rounded-xl border border-border p-3 bg-card">
          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Comment on ${SECTION_LABELS[sectionKey] ?? sectionKey}…`}
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setComposerOpen(false);
                setBody("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}

      {threads.length > 0 && (
        <ul className="space-y-2">
          {threads.map(({ parent, replies }) => (
            <li key={parent.id}>
              <CommentThread
                parent={parent}
                replies={replies}
                currentUserId={currentUserId}
                briefOwnerId={briefOwnerId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
