"use client";

/**
 * Cookie-consent banner.
 *
 * Floating card pinned to the bottom-left of the viewport. Mounted by
 * the root layout when no consent cookie exists (or its `version` is
 * older than the current policy). Submitting "Accept all", "Reject
 * all", or "Save preferences" fires `recordConsent` which writes the
 * cookie server-side and appends an audit row.
 *
 * Visual notes:
 *  - Uses the platform's design tokens (`bg-card`, `text-foreground`,
 *    `border-border`, `text-muted-foreground`) so light + dark mode
 *    follow the rest of the chrome automatically.
 *  - Animates in via a single CSS keyframe — no framer-motion dep so
 *    the banner is safe to render outside the LazyMotion provider in
 *    edge layouts.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Cookie, X } from "lucide-react";
import { recordConsent } from "@/lib/actions/consent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Event any "Cookie preferences" control dispatches to reopen this banner.
 *
 * GDPR art. 7(3) requires withdrawing consent to be as easy as giving it, but
 * the banner only auto-opens when there's no valid cookie. A global event lets
 * a footer/settings link reopen it from anywhere without threading context
 * through every layout.
 */
export const OPEN_COOKIE_PREFERENCES_EVENT = "aip:open-cookie-preferences";

/** Reopen the cookie banner from any client component. */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}

interface Props {
  initialOpen: boolean;
  policyVersion: string;
  /** Current choices, so a reopened banner reflects what's already stored. */
  initialAnalytics?: boolean;
  initialMarketing?: boolean;
}

export function CookieBanner({
  initialOpen,
  policyVersion,
  initialAnalytics = false,
  initialMarketing = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [analytics, setAnalytics] = React.useState(initialAnalytics);
  const [marketing, setMarketing] = React.useState(initialMarketing);
  const [busy, setBusy] = React.useState(false);
  const [showCustomise, setShowCustomise] = React.useState(false);

  // Reopened deliberately (vs. shown because no decision exists yet): jump
  // straight to the toggles, since the visitor came to change something.
  React.useEffect(() => {
    const reopen = () => {
      setAnalytics(initialAnalytics);
      setMarketing(initialMarketing);
      setShowCustomise(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
    return () =>
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
  }, [initialAnalytics, initialMarketing]);

  const close = () => setOpen(false);

  const submit = async (
    action: "accept-all" | "reject-all" | "custom",
    a: boolean,
    m: boolean,
  ) => {
    setBusy(true);
    try {
      await recordConsent({ action, analytics: a, marketing: m });
      close();
      // The root layout resolves `analyticsAllowed` from the consent cookie on
      // the server, so it has to re-render for the choice to take effect now
      // rather than on the visitor's next navigation.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      data-policy-version={policyVersion}
      className={cn(
        "fixed z-[60] left-4 right-4 bottom-4 sm:left-6 sm:right-auto sm:bottom-6",
        "sm:max-w-[440px]",
        "rounded-2xl border border-border bg-card/95 backdrop-blur-xl",
        "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.04)]",
        "motion-safe:animate-[cookie-in_360ms_cubic-bezier(0.22,1,0.36,1)_both]",
      )}
    >
      {/* slide-up + fade-in keyframe (scoped via <style jsx>) */}
      <style jsx>{`
        @keyframes cookie-in {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <Cookie className="h-[18px] w-[18px]" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14.5px] font-semibold tracking-tight text-foreground">
                Cookies on this site
              </h2>
              <button
                type="button"
                onClick={() => submit("reject-all", false, false)}
                disabled={busy}
                aria-label="Reject all and close"
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Necessary cookies keep you signed in. With your consent we also
              collect anonymous product analytics. We never sell your data.{" "}
              <a
                href="/trust#cookies"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Learn more
              </a>
              .
            </p>
          </div>
        </div>

        {showCustomise && (
          <fieldset className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
            <legend className="sr-only">Cookie categories</legend>
            <Toggle
              label="Necessary"
              description="Required for sign-in and core features"
              checked
              disabled
            />
            <Toggle
              label="Analytics"
              description="Anonymous usage telemetry"
              checked={analytics}
              onChange={setAnalytics}
            />
            <Toggle
              label="Marketing"
              description="Retargeting and ad measurement"
              checked={marketing}
              onChange={setMarketing}
            />
          </fieldset>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {!showCustomise ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomise(true)}
              disabled={busy}
            >
              Customize
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomise(false)}
              disabled={busy}
            >
              Back
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => submit("reject-all", false, false)}
            disabled={busy}
          >
            Reject all
          </Button>

          {showCustomise ? (
            <Button
              type="button"
              size="sm"
              onClick={() => submit("custom", analytics, marketing)}
              disabled={busy}
            >
              Save preferences
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => submit("accept-all", true, true)}
              disabled={busy}
            >
              Accept all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small toggle row used inside the Customize fieldset. */
function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors",
        !disabled && "cursor-pointer hover:bg-secondary",
        disabled && "opacity-80",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-primary" : "bg-border",
          disabled && "opacity-60",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[12px]" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-foreground">
          {label}
        </span>
        <span className="block text-[11.5px] text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  );
}
