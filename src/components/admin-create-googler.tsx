"use client";

import { useActionState, useState } from "react";
import { Copy, Check, UserPlus, AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGooglerAccountAction,
  type CreateGooglerResult,
} from "@/lib/actions/googler";

export function AdminCreateGoogler() {
  const [state, formAction, pending] = useActionState<
    CreateGooglerResult | undefined,
    FormData
  >(createGooglerAccountAction, undefined);
  const [copied, setCopied] = useState<"email" | "pw" | null>(null);

  const copy = async (value: string, which: "email" | "pw") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Provision a Google Sales Rep
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            No self sign-up. Create the account here, then share the generated
            credentials with the Googler privately.
          </p>
        </div>
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="g-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full name
          </Label>
          <Input id="g-name" name="name" placeholder="Alex Chen" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Google email
          </Label>
          <Input
            id="g-email"
            name="email"
            type="email"
            placeholder="alex@google.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job title
          </Label>
          <Input
            id="g-title"
            name="jobTitle"
            placeholder="GCP Field Sales"
            defaultValue="Google Sales Representative"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-loc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Location
          </Label>
          <Input id="g-loc" name="location" placeholder="Amsterdam, NL" />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            A temporary password will be generated and shown <strong>once</strong>.
          </p>
          <Button type="submit" disabled={pending} className="h-10 px-5">
            {pending ? "Provisioning…" : "Create Googler account"}
          </Button>
        </div>

        {state && state.ok === false && (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
      </form>

      {state && state.ok && (
        <div className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
            <KeyRound className="h-3.5 w-3.5" />
            Account created — share these credentials securely
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CredRow
              label="Email"
              value={state.email}
              onCopy={() => copy(state.email, "email")}
              copied={copied === "email"}
            />
            <CredRow
              label="Temporary password"
              value={state.tempPassword}
              mono
              onCopy={() => copy(state.tempPassword, "pw")}
              copied={copied === "pw"}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            This password will not be shown again. Ask the Googler to sign in
            at <code className="font-mono">/auth/sign-in</code> and change it.
          </p>
        </div>
      )}
    </div>
  );
}

function CredRow({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <code
          className={
            mono
              ? "font-mono text-sm text-foreground"
              : "text-sm text-foreground"
          }
        >
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
