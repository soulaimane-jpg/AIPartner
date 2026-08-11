"use client";

/**
 * PostHog provider — autocapture-aware, masked-by-default.
 *
 * Mounts a PostHog client only when `NEXT_PUBLIC_POSTHOG_KEY` is set AND
 * the visitor has consented to analytics cookies, so dev/staging without
 * telemetry stay silent. We use the EU host by default to match
 * GDPR-friendly defaults.
 *
 * **Consent (GDPR/ePrivacy)**: `analyticsAllowed` is resolved server-side
 * from the consent cookie by the root layout. Analytics must never load
 * before an explicit opt-in, and revoking consent has to stop collection
 * on the spot — hence the opt-out branch below rather than simply not
 * rendering the provider (PostHog may already be live from a previous
 * page view in the same tab).
 *
 * **Privacy posture**: input fields are masked unless explicitly opted
 * out via `data-ph-no-mask`. Sessions don't auto-record video.
 */

import { useEffect, type ReactNode } from "react";
import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";

let initialised = false;

export function PostHogProvider({
  children,
  analyticsAllowed,
}: {
  children: ReactNode;
  /** Resolved from the consent cookie server-side. */
  analyticsAllowed: boolean;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    // Consent withdrawn (or never given): stop collecting and clear any
    // identity captured earlier in this tab.
    if (!analyticsAllowed) {
      if (initialised) {
        posthog.opt_out_capturing();
        posthog.reset();
      }
      return;
    }

    if (initialised) {
      // Re-consented after a withdrawal.
      posthog.opt_in_capturing();
      return;
    }

    posthog.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false, // we trigger manually after route changes
      capture_pageleave: true,
      autocapture: {
        // Mask any element that we haven't explicitly allowed.
        css_selector_allowlist: ["[data-ph-capture]"],
      },
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
      loaded: (ph) => {
        // Respect Do-Not-Track at the client level.
        if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") {
          ph.opt_out_capturing();
        }
      },
    });
    initialised = true;
  }, [analyticsAllowed]);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !analyticsAllowed) {
    return <>{children}</>;
  }
  return <Provider client={posthog}>{children}</Provider>;
}

/** Identify the current user. Call once after sign-in. */
export function identifyPosthog(user: {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
}) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.identify(user.id, {
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  });
}

/** Reset analytics state on logout. */
export function resetPosthog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.reset();
}
