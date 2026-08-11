"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, Mail, User, Building2, ShieldCheck, Briefcase, CheckCircle2 } from "lucide-react";
import {
  signInAction,
  signUpCustomerAction,
  signUpPartnerAction,
} from "@/lib/actions/auth";
import { AuthState } from "@/lib/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LocationAutocomplete } from "@/components/auth/location-autocomplete";
import { PasswordStrength } from "@/components/auth/password-strength";
import { cn } from "@/lib/utils";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Human-readable mapping for the `?error=` codes our auth callbacks emit. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  GoogleEmailNotVerified:
    "Your Google account doesn't have a verified email. Verify it in your Google account and try again.",
  OAuthAccountNotLinked:
    "An account with that email already exists. Sign in with your password first, then link Google from your profile.",
  AccessDenied: "Access denied. Contact support if this keeps happening.",
  PartnerWorkEmailRequired:
    "Google sign-up for partners needs a company email address — we use the domain to name your company. Use your work email, or sign up with the form below.",
};

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className={cn("w-full", className)}
      size="lg"
      disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel}
        </span>
      ) : label}
    </Button>
  );
}

function PasswordInput({ id, name, autoComplete, placeholder, value, onChange }: { id: string; name: string; autoComplete: "current-password" | "new-password"; placeholder: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <FieldIcon icon={Lock} />
      <Input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} className="pl-10 pr-11" required minLength={autoComplete === "new-password" ? 8 : undefined} value={value} onChange={onChange} />
      <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FieldIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  );
}

const labelClass = "text-[13px] font-medium text-foreground";

export function SignInForm({
  role,
  title,
  subtitle,
  signUpHref,
  signUpLabel,
  submitLabel = "Sign In",
}: {
  role?: "CUSTOMER" | "PARTNER" | "ADMIN";
  title: string;
  subtitle: string;
  signUpHref?: string;
  signUpLabel?: string;
  submitLabel?: string;
}) {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const urlError = params.get("error");
  const urlErrorMessage = urlError ? AUTH_ERROR_MESSAGES[urlError] ?? "We couldn't complete sign-in. Please try again." : null;
  // Set by `completePasswordResetAction` after a successful reset.
  const justReset = params.get("reset") === "1";
  const [state, formAction] = useActionState<AuthState, FormData>(signInAction, undefined);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{subtitle}</p>
      </div>

      {urlErrorMessage && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{urlErrorMessage}</span>
        </div>
      )}

      {justReset && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Your password has been updated. Sign in with your new password.</span>
        </div>
      )}

      <GoogleSignInButton next={next || undefined} />

      <div className="relative flex items-center" aria-hidden>
        <span className="flex-1 h-px bg-border" />
        <span className="px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          or with email
        </span>
        <span className="flex-1 h-px bg-border" />
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        {role && <input type="hidden" name="role" value={role} />}
        {next && <input type="hidden" name="next" value={next} />}

        <div className="space-y-1.5">
          <Label htmlFor="email" className={labelClass}>Work email</Label>
          <div className="relative">
            <FieldIcon icon={Mail} />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={labelClass}>Password</Label>
            <Link href="/auth/reset" className="text-[12.5px] font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="sign-in-password" name="password" autoComplete="current-password" placeholder="Enter your password" />
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <SubmitButton label={submitLabel} pendingLabel="Signing you in…" />
      </form>

      {signUpHref && (
        <p className="text-center text-[13.5px] text-muted-foreground">
          {signUpLabel ?? "New to AI Partner?"}{" "}
          <Link href={next ? `${signUpHref}?next=${encodeURIComponent(next)}` : signUpHref} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[11.5px] text-muted-foreground/70">
        <Lock className="h-3 w-3" />
        Your data is encrypted and never shared with partners without consent.
      </p>
    </div>
  );
}

export function SignUpForm({
  kind: initialKind,
  title,
  subtitle,
  signInHref,
}: {
  kind: "customer" | "partner";
  title: string;
  subtitle: string;
  signInHref: string;
}) {
  const params = useSearchParams();
  const inviteToken = params.get("invite") ?? "";
  const invitedEmail = params.get("email") ?? "";
  const isInvited = !!inviteToken;
  const next = params.get("next") ?? "";
  // OAuth failures come back as `?error=`; without this the sign-up form
  // silently swallowed them and the user saw an unexplained bounce.
  const urlError = params.get("error");
  const urlErrorMessage = urlError
    ? (AUTH_ERROR_MESSAGES[urlError] ??
      "We couldn't complete sign-up. Please try again.")
    : null;

  // Brief-collaborator invite (different from a Googler lead): the
  // `/invite/[token]` page bounces unauthenticated users here with
  // `?next=/invite/<token>&email=…`. We detect that prefix and switch
  // to a stripped-down "join this brief" form.
  const collabToken =
    next.startsWith("/invite/") ? next.replace(/^\/invite\//, "").split(/[/?]/)[0] : "";
  const isCollab = !!collabToken;

  // An invited user is always a CUSTOMER — they came from a Googler referral.
  // A collaborator is its own thing (role = COLLABORATOR, no Company).
  // `?kind=partner` lets /partner/register point here and still open on the
  // right tab; `PartnerWorkEmailRequired` keeps a bounced partner on their tab
  // rather than silently resetting them to customer.
  const kindParam = params.get("kind");
  const [kind, setKind] = useState<"customer" | "partner">(
    isInvited || isCollab
      ? "customer"
      : kindParam === "partner" || urlError === "PartnerWorkEmailRequired"
        ? "partner"
        : kindParam === "customer"
          ? "customer"
          : initialKind,
  );
  const action = kind === "partner" ? signUpPartnerAction : signUpCustomerAction;
  const [state, formAction] = useActionState<AuthState, FormData>(action, undefined);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = !email || EMAIL_REGEX.test(email);
  const showEmailError = emailTouched && email && !emailValid;
  const passwordsMatch = password === confirmPassword;
  const showConfirmError = confirmPassword.length > 0 && !passwordsMatch;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isCollab
            ? "Join the project brief"
            : isInvited
              ? "You're invited to AI Partner"
              : title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {isCollab
            ? "You've been invited to collaborate on a specific Statement of Work. Create an account in under a minute — you'll only get access to the brief you were invited to."
            : isInvited
              ? "A Google Cloud rep referred you. Create your account to start building your Statement of Work — it takes under a minute."
              : subtitle}
        </p>
      </div>

      {urlErrorMessage && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{urlErrorMessage}</span>
        </div>
      )}

      {isInvited && !isCollab && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[13px] text-primary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Referred by Google.</strong> Your
            account is pre-approved — no partner sign-up needed.
          </span>
        </div>
      )}

      {isCollab && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[13px] text-primary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Scoped invite.</strong> This
            account will only see the one brief you were invited to — no
            partner directory, no other projects.
          </span>
        </div>
      )}

      {/* Account type first, because it governs the Google button below it as
          well as the email form. When this sat *under* the Google button,
          partners had no way to declare themselves before leaving for Google
          and every OAuth partner sign-up silently became a customer. */}
      {!isInvited && !isCollab && (
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="Account type">
        <button
          type="button"
          onClick={() => setKind("customer")}
          role="tab"
          aria-selected={kind === "customer"}
          className={cn(
            "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-[13px] font-medium transition-colors",
            kind === "customer"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <User className="h-3.5 w-3.5" />
          I&apos;m buying cloud services
        </button>
        <button
          type="button"
          onClick={() => setKind("partner")}
          role="tab"
          aria-selected={kind === "partner"}
          className={cn(
            "flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-[13px] font-medium transition-colors",
            kind === "partner"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          I&apos;m a GCP partner
        </button>
      </div>
      )}

      {/* Google OAuth — the `kind` below is what tells the callback whether to
          mint a PARTNER (with its Company + PartnerProfile) or a CUSTOMER.
          Collab invites ignore it and resolve to COLLABORATOR from the
          pending BriefCollaborator row. */}
      {!(isInvited && !isCollab) && (
        <>
          <GoogleSignInButton
            label={
              isCollab
                ? "Continue with Google"
                : kind === "partner"
                  ? "Sign up as a partner with Google"
                  : "Sign up with Google"
            }
            next={isCollab ? `/invite/${collabToken}` : undefined}
            kind={isCollab ? undefined : kind}
          />
          <div className="relative flex items-center" aria-hidden>
            <span className="flex-1 h-px bg-border" />
            <span className="px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              or use email
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4" noValidate>
        {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
        {!isCollab && next && <input type="hidden" name="next" value={next} />}
        {isCollab && (
          <>
            <input type="hidden" name="mode" value="collab" />
            <input type="hidden" name="collabToken" value={collabToken} />
            <input type="hidden" name="next" value={`/invite/${collabToken}`} />
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name" className={labelClass}>Full name</Label>
          <div className="relative">
            <FieldIcon icon={User} />
            <Input id="name" name="name" required autoComplete="name" className="pl-10" placeholder="Jane Smith" />
          </div>
        </div>

        {/* Company / role / location — hidden in collab mode (no tenant created). */}
        {!isCollab && (
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className={labelClass}>
              {kind === "partner" ? "Partner company" : "Company name"}
            </Label>
            <div className="relative">
              <FieldIcon icon={Building2} />
              <Input
                id="companyName"
                name="companyName"
                required
                autoComplete="organization"
                className="pl-10"
                placeholder={kind === "partner" ? "Delta Cloud Partners" : "Global Tech Corp"}
              />
            </div>
          </div>
        )}

        {kind === "customer" && !isCollab && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle" className={labelClass}>Your role</Label>
              <div className="relative">
                <FieldIcon icon={Briefcase} />
                <Input
                  id="jobTitle"
                  name="jobTitle"
                  required
                  autoComplete="organization-title"
                  className="pl-10"
                  placeholder="VP Engineering"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className={labelClass}>Location</Label>
              <LocationAutocomplete
                id="location"
                name="location"
                required
                placeholder="Start typing a city…"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className={labelClass}>Work email</Label>
          <div className="relative">
            <FieldIcon icon={Mail} />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              className={cn("pl-10", showEmailError && "border-destructive focus-visible:ring-destructive/40")}
              placeholder="you@company.com"
              required
              value={email}
              defaultValue={undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              readOnly={(isInvited || isCollab) && !!invitedEmail}
            />
            {email && emailValid && emailTouched && (
              <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            )}
          </div>
          {showEmailError && (
            <p className="text-[11px] text-destructive">Please enter a valid email address.</p>
          )}
          {isInvited && invitedEmail && (
            <p className="text-[11px] text-muted-foreground">
              This must match the email your Google rep referred you with.
            </p>
          )}
          {isCollab && invitedEmail && (
            <p className="text-[11px] text-muted-foreground">
              This must match the email the invitation was sent to.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className={labelClass}>Password</Label>
          <PasswordInput id="sign-up-password" name="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrength password={password} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className={labelClass}>Confirm password</Label>
          <div className="relative">
            <FieldIcon icon={Lock} />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={cn("pl-10", showConfirmError && "border-destructive focus-visible:ring-destructive/40")}
              placeholder="Re-enter your password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {showConfirmError && (
            <p className="text-[11px] text-destructive">Passwords do not match.</p>
          )}
          {confirmPassword && passwordsMatch && (
            <p className="text-[11px] text-emerald-600">Passwords match.</p>
          )}
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-[13px] text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <SubmitButton
          pendingLabel="Creating your account…"
          label={
            isCollab
              ? "Create account & open brief"
              : kind === "partner"
                ? "Create partner account"
                : "Create account"
          }
        />
      </form>

      <p className="text-center text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `${signInHref}?next=${encodeURIComponent(next)}` : signInHref} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[11.5px] text-muted-foreground/70">
        <Lock className="h-3 w-3" />
        Your data is encrypted and never shared with partners without consent.
      </p>
    </div>
  );
}
