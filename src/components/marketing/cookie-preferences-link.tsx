"use client";

/**
 * "Cookie preferences" trigger.
 *
 * GDPR art. 7(3): withdrawing consent must be as easy as giving it. The banner
 * only auto-opens when no valid decision is stored, so this link is the
 * permanent way back into it. Rendered in the footer, which appears on the
 * public pages where consent is collected.
 */

import { openCookiePreferences } from "@/components/marketing/cookie-banner";

export function CookiePreferencesLink({
  className,
}: {
  className?: string;
}) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      Cookie preferences
    </button>
  );
}
