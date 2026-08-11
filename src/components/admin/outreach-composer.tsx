"use client";

/**
 * AI-assisted outreach composer modal.
 *
 * Flow:
 *   1. Open with empty fields.
 *   2. Click "AI draft" → calls `draftOutreachAction`, populates
 *      subject + body + fitNote.
 *   3. Admin edits freely.
 *   4. Click "Send" → calls `sourcePartnersAction` with a 1-partner
 *      `selections` array so the existing sourcing pipeline (token +
 *      mock email + Match upsert) handles delivery.
 *
 * The admin is the gatekeeper — we never auto-send AI output. The
 * `fitNote` is admin-only context and is *not* sent to the partner.
 */

import { useEffect, useState, useTransition } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { draftOutreachAction } from "@/lib/actions/ai-outreach";
import { sourcePartnersAction } from "@/lib/actions/admin";

export function OutreachComposer({
  briefId,
  partnerId,
  partnerName,
  onClose,
}: {
  briefId: string;
  partnerId: string;
  partnerName: string;
  onClose: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fitNote, setFitNote] = useState<string | null>(null);
  const [styleHint, setStyleHint] = useState("");
  const [drafting, startDraft] = useTransition();
  const [sending, startSend] = useTransition();

  // Esc closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function aiDraft() {
    startDraft(async () => {
      const result = await draftOutreachAction({
        briefId,
        partnerId,
        styleHint: styleHint.trim() || undefined,
      });
      if (result.ok) {
        setSubject(result.data.subject);
        setBody(result.data.body);
        setFitNote(result.data.fitNote ?? null);
        toast.success("Draft ready");
      } else {
        toast.error(
          result.error.code === "LLM_FAILURE"
            ? "AI writer is unavailable right now."
            : "Could not draft.",
        );
      }
    });
  }

  function send() {
    if (!recipientEmail.trim()) {
      toast.error("Add a recipient email");
      return;
    }
    if (subject.trim().length < 4 || body.trim().length < 40) {
      toast.error("Subject + body required");
      return;
    }
    startSend(async () => {
      const result = await sourcePartnersAction({
        briefId,
        selections: [
          {
            partnerId,
            recipientEmail: recipientEmail.trim(),
            customSubject: subject.trim(),
            customBody: body.trim(),
          },
        ],
      });
      if (result.ok) {
        toast.success(`Sent — ${partnerName} invited`);
        onClose();
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not send",
        );
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Compose outreach to ${partnerName}`}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-card border border-line sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Compose outreach
              </h2>
              <p className="text-[11px] text-muted-foreground">
                to {partnerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Recipient email
            </Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="contact@partner.com"
            />
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 bg-secondary/30 space-y-2">
            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              AI draft (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                value={styleHint}
                onChange={(e) => setStyleHint(e.target.value)}
                placeholder="Style hint: e.g. 'emphasise EMEA presence'"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={aiDraft}
                disabled={drafting}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {drafting ? "Drafting…" : "AI draft"}
              </Button>
            </div>
            {fitNote && (
              <p className="text-[11.5px] text-muted-foreground italic">
                Admin-only note: {fitNote}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Subject
            </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              placeholder="Subject line"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Body
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              maxLength={4000}
              placeholder="Email body…"
              className="font-mono text-[12.5px]"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-card/80">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending}>
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
