"use client";

import { useEffect } from "react";

/**
 * Suppresses noisy runtime errors coming from browser extensions
 * (MetaMask, Phantom, ad blockers, etc.) so the Next.js dev overlay
 * doesn't flash them as if they were app errors.
 *
 * We ONLY swallow events whose stack/source clearly originates from a
 * `chrome-extension://` or `moz-extension://` URL, so real app errors
 * still surface normally.
 */
export function SuppressExtensionErrors() {
  useEffect(() => {
    const isExtension = (text: string) =>
      /chrome-extension:\/\/|moz-extension:\/\/|MetaMask|Phantom/i.test(text);

    const onError = (e: ErrorEvent) => {
      const src = (e.filename ?? "") + " " + (e.error?.stack ?? e.message ?? "");
      if (isExtension(src)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const text =
        typeof reason === "string"
          ? reason
          : (reason?.stack ?? reason?.message ?? "");
      if (isExtension(String(text))) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
