"use client";

import { useFormStatus } from "react-dom";
import { signInWithGoogleAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/**
 * "Continue with Google" button — used on both /auth/sign-in and
 * /auth/sign-up. Submits to the server action that kicks off the
 * OAuth round-trip via NextAuth.
 */
export function GoogleSignInButton({
  next,
  kind,
  label = "Continue with Google",
  className,
}: {
  /** Where to land after a successful OAuth round-trip. */
  next?: string;
  /**
   * Declared account type. Must be forwarded on the sign-up form, otherwise a
   * partner ends up as a CUSTOMER: the OAuth callback has no other way to learn
   * which tab was selected.
   */
  kind?: "customer" | "partner";
  label?: string;
  className?: string;
}) {
  return (
    <form action={signInWithGoogleAction} className="w-full">
      {next && <input type="hidden" name="next" value={next} />}
      {kind && <input type="hidden" name="kind" value={kind} />}
      <SubmitButton label={label} className={className} />
    </form>
  );
}

function SubmitButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2.5 h-11 px-4 rounded-md",
        "border border-border bg-card text-foreground text-[14px] font-medium",
        "transition-colors hover:bg-secondary/50",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Redirecting to Google…
        </>
      ) : (
        <>
          <GoogleMark className="h-[18px] w-[18px]" />
          {label}
        </>
      )}
    </button>
  );
}

/**
 * Official Google "G" logo (4-colour SVG). Re-drawn here so we don't
 * pull in another dependency just for one icon.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
