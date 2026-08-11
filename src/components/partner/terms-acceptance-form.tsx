"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Forward,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  acceptPartnerTermsAction,
  forwardOutreachAction,
} from "@/lib/actions/partner";

type Mode = "accept" | "forward";

export function TermsAcceptanceForm({
  token,
  partnerName,
  briefTitle,
  customerIndustry,
  customerRegion,
  termsText,
  termsVersion,
  recipientEmail,
}: {
  token: string;
  partnerName: string;
  briefTitle: string;
  customerIndustry: string;
  customerRegion: string;
  termsText: string;
  termsVersion: string;
  recipientEmail: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("accept");
  const [acceptedName, setAcceptedName] = useState("");
  const [authority, setAuthority] = useState(false);

  const [fwdEmail, setFwdEmail] = useState("");
  const [fwdName, setFwdName] = useState("");
  const [fwdNote, setFwdNote] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAccept() {
    if (acceptedName.trim().length < 2) {
      toast.error("Type your full name to e-sign");
      return;
    }
    if (!authority) {
      toast.error("Confirm you have authority to accept");
      return;
    }
    startTransition(async () => {
      const result = await acceptPartnerTermsAction({
        token,
        acceptedName: acceptedName.trim(),
        authorityChecked: authority,
        userAgent:
          typeof navigator !== "undefined"
            ? navigator.userAgent
            : undefined,
      });
      if (result.ok) {
        toast.success("Terms accepted — thank you!");
        router.refresh();
      } else {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Validation failed")
            : "Could not accept",
        );
      }
    });
  }

  function handleForward() {
    if (!fwdEmail) {
      toast.error("Add your colleague's email");
      return;
    }
    startTransition(async () => {
      const res = await forwardOutreachAction({
        token,
        newEmail: fwdEmail.trim(),
        newName: fwdName.trim() || undefined,
        note: fwdNote.trim() || undefined,
      });
      if (res.ok) {
        toast.success("Forwarded — your colleague will receive the link.");
        router.replace(
          `/partner/accept/forwarded?to=${encodeURIComponent(res.data.newAcceptUrl)}`,
        );
      } else {
        toast.error(
          res.error.code === "CONFLICT" && "reason" in res.error
            ? res.error.reason
            : "Could not forward",
        );
      }
    });
  }

  return (
    <div className="max-w-2xl w-full space-y-6">
      <header className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-1/10 text-brand-1 shrink-0">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Standard lead terms for {partnerName}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            <strong>Opportunity:</strong> {briefTitle}
            {" · "}
            <strong>Customer:</strong> {customerIndustry} ({customerRegion})
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-line bg-card p-6 whitespace-pre-wrap text-[13px] font-mono leading-[1.6] text-foreground max-h-[40vh] overflow-y-auto">
        {termsText}
      </div>

      <div className="flex items-center justify-center gap-2 text-[12px]">
        <button
          type="button"
          onClick={() => setMode("accept")}
          className={`rounded-full px-3 py-1 font-medium ${
            mode === "accept"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Accept on behalf of {partnerName}
        </button>
        <button
          type="button"
          onClick={() => setMode("forward")}
          className={`rounded-full px-3 py-1 font-medium ${
            mode === "forward"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Forward to a colleague
        </button>
      </div>

      {mode === "accept" ? (
        <div className="rounded-2xl border border-line bg-card p-6 space-y-4">
          <FormField
            label="Your full name (e-signature)"
            htmlFor="signer-name"
            required
            helper={`We'll record this with timestamp + IP. Sent to: ${recipientEmail}.`}
          >
            <Input
              id="signer-name"
              value={acceptedName}
              onChange={(e) => setAcceptedName(e.target.value)}
              placeholder="Alex Doe"
              autoComplete="name"
            />
          </FormField>
          <label className="flex items-start gap-2 text-[13px] text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={authority}
              onChange={(e) => setAuthority(e.target.checked)}
              className="mt-1"
            />
            <span>
              I have authority to accept these terms ({termsVersion}) on behalf
              of <strong>{partnerName}</strong>.
            </span>
          </label>
          <Button
            type="button"
            size="md"
            onClick={handleAccept}
            disabled={pending}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Accept terms
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card p-6 space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Send the same link to a colleague (e.g. your sales VP). The
            current link will stop working — only your colleague&apos;s link
            will be active.
          </p>
          <FormField
            label="Colleague's email"
            htmlFor="fwd-email"
            required
          >
            <Input
              id="fwd-email"
              type="email"
              value={fwdEmail}
              onChange={(e) => setFwdEmail(e.target.value)}
              placeholder="sales-vp@yourcompany.com"
            />
          </FormField>
          <FormField label="Their name (optional)" htmlFor="fwd-name">
            <Input
              id="fwd-name"
              value={fwdName}
              onChange={(e) => setFwdName(e.target.value)}
              placeholder="Sam Director"
            />
          </FormField>
          <FormField label="Short note for them (optional)" htmlFor="fwd-note">
            <Textarea
              id="fwd-note"
              rows={3}
              value={fwdNote}
              onChange={(e) => setFwdNote(e.target.value)}
              placeholder="Sam — pls review and accept by Friday."
            />
          </FormField>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("accept")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button
              type="button"
              size="md"
              onClick={handleForward}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Forward className="h-3.5 w-3.5" />
              )}
              Forward the link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
