"use client";

/**
 * MFA enrolment + management UI.
 *
 * Three states:
 *   1. Off — show a "Set up two-factor auth" CTA.
 *   2. Pending verification — QR + recovery codes shown, awaiting first
 *      successful TOTP code.
 *   3. On — show last-used info + "Disable" CTA.
 *
 * The recovery codes are shown **once**, immediately after enrolment.
 * The user is responsible for storing them; we don't allow re-display.
 */

import { useState, useTransition } from "react";
import Image from "next/image";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startMfaEnrolmentAction,
  confirmMfaEnrolmentAction,
  disableMfaAction,
} from "@/lib/actions/auth-mfa";

type Phase = "idle" | "enrolling" | "enabled";

interface Enrolment {
  qrcodeDataUrl: string;
  secret: string;
  recoveryCodes: string[];
}

export function MfaSection({
  enrolled,
  enabled,
  remainingRecoveryCodes,
}: {
  enrolled: boolean;
  enabled: boolean;
  remainingRecoveryCodes: number;
}) {
  const [phase, setPhase] = useState<Phase>(enabled ? "enabled" : "idle");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function start() {
    startTransition(async () => {
      const result = await startMfaEnrolmentAction({});
      if (!result.ok) {
        toast.error("Could not start enrolment.");
        return;
      }
      setEnrolment({
        qrcodeDataUrl: result.data.qrcodeDataUrl,
        secret: result.data.secret,
        recoveryCodes: result.data.recoveryCodes,
      });
      setPhase("enrolling");
    });
  }

  function confirmEnrolment() {
    startTransition(async () => {
      const result = await confirmMfaEnrolmentAction({ code });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Code didn't match.")
            : "Could not enable two-factor auth.",
        );
        return;
      }
      toast.success("Two-factor authentication enabled");
      setPhase("enabled");
      setCode("");
    });
  }

  function disableMfa() {
    if (
      !window.confirm(
        "Disable two-factor authentication? Your account becomes less secure.",
      )
    )
      return;
    const userCode = window.prompt(
      "Enter a TOTP or recovery code to confirm.",
    );
    if (!userCode) return;
    startTransition(async () => {
      const result = await disableMfaAction({ code: userCode });
      if (!result.ok) {
        toast.error(
          result.error.code === "FORBIDDEN"
            ? "Code didn't match."
            : "Could not disable.",
        );
        return;
      }
      toast.success("Two-factor authentication disabled");
      setPhase("idle");
      setEnrolment(null);
    });
  }

  if (phase === "enabled") {
    return (
      <div className="flex flex-col items-stretch justify-between gap-4 pt-2 sm:flex-row sm:items-center">
        <div className="text-sm flex items-center gap-2 text-success font-medium">
          <ShieldCheck className="h-4 w-4" />
          Active · {remainingRecoveryCodes} recovery codes remaining
        </div>
        <Button variant="outline" size="sm" onClick={disableMfa} disabled={pending} className="w-full sm:w-auto">
          Disable
        </Button>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className="pt-2" aria-busy={pending || undefined}>
        <Button onClick={start} disabled={pending} className="w-full sm:w-auto">
          {pending ? "Starting…" : "Set up two-factor auth"}
        </Button>
        {enrolled && (
          <p className="text-xs text-muted-foreground mt-2">
            A previous enrolment was abandoned — starting again replaces it.
          </p>
        )}
      </div>
    );
  }

  // phase === "enrolling"
  return (
    <div className="space-y-4 pt-2">
      <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-start">
        {enrolment?.qrcodeDataUrl && (
          <Image
            src={enrolment.qrcodeDataUrl}
            alt="Scan with your authenticator app"
            width={160}
            height={160}
            className="rounded border border-border bg-card p-2"
            unoptimized
          />
        )}
        <div className="space-y-2 text-sm">
          <p>
            <strong>1.</strong> Scan the QR with your authenticator app, or
            paste the secret manually.
          </p>
          {enrolment?.secret && (
            <button
              type="button"
              className="font-mono text-xs bg-muted rounded px-2 py-1 inline-flex items-center gap-1 hover:bg-muted/70"
              onClick={() => {
                navigator.clipboard.writeText(enrolment.secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {enrolment.secret}
            </button>
          )}
          <p>
            <strong>2.</strong> Enter the 6-digit code your app shows.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123 456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              disabled={pending}
              className="font-mono tracking-widest sm:max-w-48"
            />
            <Button
              onClick={confirmEnrolment}
              disabled={pending || code.length !== 6}
            >
              {pending ? "Verifying…" : "Verify & enable"}
            </Button>
          </div>
        </div>
      </div>

      {enrolment?.recoveryCodes && enrolment.recoveryCodes.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Save these recovery codes</p>
          <p className="text-foreground/80">
            You&apos;ll need one of these if you lose your authenticator app.
            They&apos;re shown <strong>once</strong>; we can&apos;t display them again.
          </p>
          <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
            {enrolment.recoveryCodes.map((c) => (
              <li key={c} className="rounded border border-border bg-card px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(
                enrolment.recoveryCodes.join("\n"),
              );
              toast.success("Recovery codes copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy all
          </Button>
        </div>
      )}
    </div>
  );
}
