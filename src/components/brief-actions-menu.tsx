"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateBriefAction, deleteBriefAction } from "@/lib/actions/briefs";

export function BriefActionsMenu({
  briefId,
  briefTitle,
  variant = "icon",
}: {
  briefId: string;
  briefTitle: string;
  variant?: "icon" | "row";
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(briefTitle);
  const [pending, startTransition] = useTransition();

  function handleRename() {
    startTransition(async () => {
      const result = await updateBriefAction({
        briefId,
        patch: { title: newTitle.trim() },
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "FORBIDDEN"
            ? "You don't have permission to edit this brief."
            : "Failed to rename",
        );
        return;
      }
      toast.success("Brief renamed");
      setRenameOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBriefAction({ briefId });
      if (!result.ok) {
        toast.error(
          result.error.code === "FORBIDDEN"
            ? "You don't have permission to delete this brief."
            : "Failed to delete",
        );
        return;
      }
      toast.success("Brief deleted");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Brief actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Brief actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNewTitle(briefTitle);
              setRenameOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename brief</DialogTitle>
            <DialogDescription>
              Give your brief a new descriptive title.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={120}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  e.preventDefault();
                  handleRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={pending || !newTitle.trim()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete brief</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{briefTitle}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
