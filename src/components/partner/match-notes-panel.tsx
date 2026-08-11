"use client";

/**
 * Per-match private notes panel for the partner inbox detail page.
 *
 * Three responsibilities:
 *   - Render existing notes (most recent first).
 *   - Inline-edit (or add) a note with tags + optional reminder date.
 *   - Delete a note with a confirm.
 *
 * Notes are partner-private — never visible to the customer or admin.
 * The component takes `initial` from the server so the first paint is
 * fast; subsequent mutations re-fetch via `router.refresh()`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Plus, Tag, Bell, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  upsertMatchNoteAction,
  deleteMatchNoteAction,
} from "@/lib/actions/match-notes";

export type MatchNoteRow = {
  id: string;
  body: string;
  tags: string[];
  remindAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string | null; email: string };
};

export function MatchNotesPanel({
  matchId,
  initial,
}: {
  matchId: string;
  initial: MatchNoteRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    id?: string;
    body: string;
    tags: string;
    remindAt: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function startNew() {
    setEditing({ body: "", tags: "", remindAt: "" });
  }
  function startEdit(n: MatchNoteRow) {
    setEditing({
      id: n.id,
      body: n.body,
      tags: n.tags.join(", "),
      remindAt: n.remindAt ? n.remindAt.toISOString().slice(0, 10) : "",
    });
  }

  function save() {
    if (!editing || editing.body.trim().length === 0) {
      toast.error("Add some text first.");
      return;
    }
    startTransition(async () => {
      const result = await upsertMatchNoteAction({
        id: editing.id,
        matchId,
        body: editing.body.trim(),
        tags: editing.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        remindAt: editing.remindAt
          ? new Date(editing.remindAt).toISOString()
          : "",
      });
      if (result.ok) {
        toast.success("Saved");
        setEditing(null);
        router.refresh();
      } else {
        toast.error("Could not save.");
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this note?")) return;
    startTransition(async () => {
      const result = await deleteMatchNoteAction({ id });
      if (result.ok) {
        toast.success("Deleted");
        router.refresh();
      } else {
        toast.error("Could not delete.");
      }
    });
  }

  return (
    <section
      aria-label="Private match notes"
      className="rounded-2xl border border-line bg-card overflow-hidden"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-700">
            <StickyNote className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Private notes</h2>
            <p className="text-[11px] text-muted-foreground">
              Visible only to your team. Never seen by customer or admin.
            </p>
          </div>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" />
            Note
          </Button>
        )}
      </header>

      {editing && (
        <div className="px-4 py-3 border-b border-line space-y-2.5 bg-secondary/30">
          <Textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={4}
            placeholder="What's the latest? Internal-only context, links, key contacts."
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags (comma-separated)
              </Label>
              <Input
                value={editing.tags}
                onChange={(e) =>
                  setEditing({ ...editing, tags: e.target.value })
                }
                placeholder="warm, exec-meet, q3"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1">
                <Bell className="h-3 w-3" /> Remind me
              </Label>
              <Input
                type="date"
                value={editing.remindAt}
                onChange={(e) =>
                  setEditing({ ...editing, remindAt: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
              {editing.id ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {initial.length === 0 && !editing ? (
          <li className="px-4 py-6 text-center text-[12px] text-muted-foreground italic">
            No notes yet. Add one to keep your team aligned.
          </li>
        ) : (
          initial.map((n) => (
            <li key={n.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {n.author.name ?? n.author.email}
                  </span>
                  {" · "}
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {n.remindAt && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                      <Bell className="h-3 w-3" />
                      {new Date(n.remindAt).toLocaleDateString()}
                    </span>
                  )}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(n)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[13px] whitespace-pre-wrap leading-snug">
                {n.body}
              </p>
              {n.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {n.tags.map((t) => (
                    <Badge
                      key={t}
                      tone="neutral"
                      shape="soft"
                      size="sm"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
