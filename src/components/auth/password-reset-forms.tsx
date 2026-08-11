"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Mail } from "lucide-react";
import {
  requestPasswordResetAction,
  completePasswordResetAction,
} from "@/lib/actions/auth";
import type { AuthState } from "@/lib/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/auth/password-strength";
import { cn } from "@/lib/utils";

const labelClass = "text-[13px] font-medium text-foreground";

function FieldIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}

function Alert({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-[13px]",
        kind === "error"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function BackToSignIn() {
  return (
    <Link
      href="/auth/sign-in"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to sign in
    </Link>
  );
}

/** Step 1 — ask for the account email and send the reset link. */
export function RequestPasswordResetForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Enter the email address for your account and we&apos;ll send you a link
          to choose a new password.
        </p>
      </div>

      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      {/* Once the link is sent there's nothing more to do on this screen, so
          hide the form and leave only the confirmation + a way back. */}
      {!state?.success && (
        <form action={formAction} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" className={labelClass}>
              Work email
            </Label>
            <div className="relative">
              <FieldIcon icon={Mail} />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@company.com"
                defaultValue={initialEmail}
                className="pl-10"
                required
              />
            </div>
          </div>
          <SubmitButton label="Send reset link" pendingLabel="Sending…" />
        </form>
      )}

      <BackToSignIn />
    </div>
  );
}

/** Step 2 — choose a new password using the token from the emailed link. */
export function CompletePasswordResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    completePasswordResetAction,
    undefined,
  );
  const [password, setPassword] = useState("");

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Pick something at least 8 characters long. Signing in elsewhere will
          require the new password.
        </p>
      </div>

      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="password" className={labelClass}>
            New password
          </Label>
          <div className="relative">
            <FieldIcon icon={Lock} />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="pl-10"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className={labelClass}>
            Confirm new password
          </Label>
          <div className="relative">
            <FieldIcon icon={Lock} />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="pl-10"
              required
              minLength={8}
            />
          </div>
        </div>

        <SubmitButton label="Update password" pendingLabel="Updating…" />
      </form>

      <BackToSignIn />
    </div>
  );
}

/** Shown when the token in the URL is unknown, already used, or expired. */
export function ExpiredResetLink() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          This link has expired
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Password reset links are single-use and valid for 60 minutes. Request a
          new one to continue.
        </p>
      </div>
      <Button asChild className="w-full" size="lg">
        <Link href="/auth/reset">Request a new link</Link>
      </Button>
      <BackToSignIn />
    </div>
  );
}
