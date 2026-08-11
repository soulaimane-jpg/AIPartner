"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { COLLABORATOR_ROLES, type CollaboratorRole } from "@/lib/enums";
import {
  inviteCollaboratorsAction,
  removeCollaboratorAction,
  resendCollaboratorInviteAction,
  approveBriefAsCollaboratorAction,
  rejectBriefAsCollaboratorAction,
  leaveReviewNoteAction,
} from "@/lib/actions/collaborators";

export type CollaboratorRow = {
  id: string;
  email: string;
  name: string | null;
  role: CollaboratorRole;
  status: "INVITED" | "ACTIVE" | "REMOVED";
  acceptedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewNote: string | null;
  inviteToken: string;
};

type InviteDraft = { email: string; name: string; role: CollaboratorRole };

const ROLE_LABEL: Record<CollaboratorRole, string> = {
  VIEWER: "Viewer",
  EDITOR: "Editor",
};

export function CollaboratorsPanel({
  briefId,
  briefTitle,
  collaborators,
  currentUserEmail,
  isOwner,
}: {
  briefId: string;
  briefTitle: string;
  collaborators: CollaboratorRow[];
  currentUserEmail: string;
  isOwner: boolean;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [drafts, setDrafts] = useState<InviteDraft[]>([
    { email: "", name: "", role: "VIEWER" },
  ]);
  const [pending, startTransition] = useTransition();
  const [reviewOpenFor, setReviewOpenFor] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");

  const myInvite = collaborators.find(
    (c) => c.email.toLowerCase() === currentUserEmail.toLowerCase(),
  );

  const visible = collaborators.filter((c) => c.status !== "REMOVED");
  const approverCount = visible.filter((c) => c.role === "EDITOR").length;
  const approvedCount = visible.filter(
    (c) => c.role === "EDITOR" && c.approvedAt,
  ).length;

  function updateDraft(i: number, patch: Partial<InviteDraft>) {
    setDrafts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addDraft() {
    setDrafts((r) => [...r, { email: "", name: "", role: "VIEWER" }]);
  }
  function removeDraft(i: number) {
    setDrafts((r) => r.filter((_, idx) => idx !== i));
  }

  function handleSendInvites() {
    const cleaned = drafts
      .map((r) => ({ ...r, email: r.email.trim(), name: r.name.trim() }))
      .filter((r) => r.email.length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one email");
      return;
    }
    startTransition(async () => {
      const res = await inviteCollaboratorsAction({
        briefId,
        invites: cleaned,
      });
      if (res.ok) {
        toast.success(
          `Sent ${res.data.invited} invitation${res.data.invited === 1 ? "" : "s"}`,
        );
        if (res.data.skipped.length > 0) {
          toast.message(`Skipped: ${res.data.skipped.join(", ")}`);
        }
        setDrafts([{ email: "", name: "", role: "VIEWER" }]);
        setShowInvite(false);
      } else {
        toast.error(
          res.error.code === "INVALID_INPUT"
            ? (res.error.issues[0]?.message ?? "Validation failed")
            : "Could not send invites",
        );
      }
    });
  }

  function handleRemove(collaboratorId: string) {
    startTransition(async () => {
      const result = await removeCollaboratorAction({ collaboratorId });
      if (result.ok) {
        toast.success("Removed");
      } else {
        toast.error("Could not remove");
      }
    });
  }

  function handleApprove(collaboratorId: string) {
    startTransition(async () => {
      const result = await approveBriefAsCollaboratorAction({ collaboratorId });
      if (result.ok) {
        toast.success("SoW approved");
      } else {
        toast.error(
          result.error.code === "FORBIDDEN" && "reason" in result.error
            ? result.error.reason
            : "Could not approve",
        );
      }
    });
  }

  function handleReject(collaboratorId: string) {
    if (reviewText.trim().length < 2) {
      toast.error("Add a note explaining the rejection");
      return;
    }
    startTransition(async () => {
      const result = await rejectBriefAsCollaboratorAction({
        collaboratorId,
        note: reviewText,
      });
      if (result.ok) {
        toast.success("SoW rejected with notes");
        setReviewOpenFor(null);
        setReviewText("");
      } else {
        toast.error(
          result.error.code === "FORBIDDEN" && "reason" in result.error
            ? result.error.reason
            : "Could not reject",
        );
      }
    });
  }

  function handleResend(collaboratorId: string) {
    startTransition(async () => {
      const result = await resendCollaboratorInviteAction({ collaboratorId });
      if (result.ok) {
        toast.success("Invite email re-sent");
      } else {
        toast.error(
          result.error.code === "FORBIDDEN" && "reason" in result.error
            ? result.error.reason
            : "Could not resend invite",
        );
      }
    });
  }

  async function handleCopyLink(inviteToken: string) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/invite/${inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard");
    } catch {
      toast.error("Couldn't copy — copy this link manually: " + url);
    }
  }

  function handleSubmitNote(collaboratorId: string) {
    if (reviewText.trim().length < 2) {
      toast.error("Note is too short");
      return;
    }
    startTransition(async () => {
      const result = await leaveReviewNoteAction({
        collaboratorId,
        note: reviewText,
      });
      if (result.ok) {
        toast.success("Review note saved");
        setReviewOpenFor(null);
        setReviewText("");
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not save note",
        );
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <header className="flex items-center justify-between gap-3 p-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">
            Collaborators
          </h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {visible.length === 0
              ? "Add colleagues who'll review or approve this brief."
              : `${visible.length} collaborator${visible.length === 1 ? "" : "s"}` +
                (approverCount > 0
                  ? ` · ${approvedCount}/${approverCount} editors signed off`
                  : "")}
          </p>
        </div>
        {isOwner && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowInvite((s) => !s)}
          >
            {showInvite ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {showInvite ? "Close" : "Invite"}
          </Button>
        )}
      </header>

      {showInvite && isOwner && (
        <div className="p-4 space-y-3 bg-surface-1 border-b border-line">
          {drafts.map((row, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1.4fr_1fr_auto] gap-2 items-start">
              <FormField label={i === 0 ? "Email" : undefined} htmlFor={`coll-em-${i}`}>
                <Input
                  id={`coll-em-${i}`}
                  type="email"
                  placeholder="colleague@yourcompany.com"
                  value={row.email}
                  onChange={(e) => updateDraft(i, { email: e.target.value })}
                />
              </FormField>
              <FormField label={i === 0 ? "Name" : undefined} htmlFor={`coll-nm-${i}`}>
                <Input
                  id={`coll-nm-${i}`}
                  placeholder="Optional"
                  value={row.name}
                  onChange={(e) => updateDraft(i, { name: e.target.value })}
                />
              </FormField>
              <FormField label={i === 0 ? "Role" : undefined} htmlFor={`coll-rl-${i}`}>
                <select
                  id={`coll-rl-${i}`}
                  value={row.role}
                  onChange={(e) =>
                    updateDraft(i, { role: e.target.value as CollaboratorRole })
                  }
                  className="flex h-9 w-full rounded-md border border-line bg-card text-[13.5px] px-3 shadow-[var(--elev-1)] focus-visible:outline-none focus-visible:border-brand-1"
                >
                  {COLLABORATOR_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className={i === 0 ? "pt-7" : "pt-1"}>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => removeDraft(i)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addDraft}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-1 hover:text-magenta-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendInvites}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Send invitations
            </Button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-line">
          {visible.map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-medium text-foreground">
                      {c.name || c.email}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-brand-1/8 text-brand-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                      {ROLE_LABEL[c.role]}
                    </span>
                    {c.approvedAt ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-success">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    ) : c.rejectedAt ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                        <X className="h-3 w-3" /> Rejected
                      </span>
                    ) : c.status === "INVITED" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> Awaiting acceptance
                      </span>
                    ) : c.reviewNote ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-1">
                        <MessageSquare className="h-3 w-3" /> Left a note
                      </span>
                    ) : null}
                  </div>
                  {c.name && (
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {c.email}
                    </div>
                  )}
                  {c.reviewNote && (
                    <p className="mt-2 text-[12.5px] text-foreground bg-surface-1 rounded-md p-2.5 border border-line">
                      <span className="text-muted-foreground">Review: </span>
                      {c.reviewNote}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Collaborator-side actions: visible when *I* am this collaborator */}
                  {myInvite?.id === c.id && c.role === "EDITOR" && !c.approvedAt && !c.rejectedAt && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApprove(c.id)}
                        disabled={pending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewOpenFor(c.id);
                          setReviewText(c.reviewNote ?? "");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                  {myInvite?.id === c.id && c.role === "VIEWER" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewOpenFor(c.id);
                        setReviewText(c.reviewNote ?? "");
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {c.reviewNote ? "Edit note" : "Leave note"}
                    </Button>
                  )}
                  {/* Owner-only actions for pending invites: copy magic
                      link + resend email. We surface these on INVITED rows
                      so the owner can chase a colleague who never received
                      the email (spam filter, wrong address, etc.). */}
                  {isOwner && c.status === "INVITED" && (
                    <>
                      <button
                        type="button"
                        aria-label="Copy invite link"
                        title="Copy invite link"
                        onClick={() => handleCopyLink(c.inviteToken)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Resend invite email"
                        title="Resend invite email"
                        onClick={() => handleResend(c.id)}
                        disabled={pending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      aria-label="Remove collaborator"
                      onClick={() => handleRemove(c.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {reviewOpenFor === c.id && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    rows={3}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder={`Notes for ${briefTitle}…`}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReviewOpenFor(null);
                        setReviewText("");
                      }}
                    >
                      Cancel
                    </Button>
                    {myInvite?.id === c.id && c.role === "EDITOR" && !c.approvedAt && !c.rejectedAt && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(c.id)}
                        disabled={pending}
                      >
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Reject with note
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleSubmitNote(c.id)}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save note
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
