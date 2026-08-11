/**
 * Cookie-consent recording.
 *
 * The banner client component calls `recordConsent()` after the
 * visitor clicks Accept / Reject / Save. This action:
 *
 *   1. Validates the categories.
 *   2. Persists the cookie itself (HttpOnly=false because the banner
 *      reads it client-side; we trust the cookie shape because it's
 *      validated server-side again on the next request).
 *   3. Appends a `CookieConsent` audit row.
 *
 * Public action (no auth required) — visitors don't need to sign in
 * to consent.
 */

"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { defineAction } from "@/lib/actions/define";
import { insertRow } from "@/lib/db";
import {
  COOKIE_NAME,
  POLICY_VERSION,
  newCookieId,
} from "@/lib/cookie-consent";

const ACTIONS = ["accept-all", "reject-all", "custom", "withdraw"] as const;

export const recordConsent = defineAction({
  name: "consent.record",
  permission: null, // public
  rateLimit: {
    scope: "consent.record",
    limit: 30,
    windowSec: 60,
    // Anonymous callers — bucket on cookieId or IP hash.
    key: (input, ctx) =>
      input.cookieId ? `cookie:${input.cookieId}` : ctx.ipHash ? `ip:${ctx.ipHash}` : null,
  },
  input: z.object({
    cookieId: z.string().min(8).optional(),
    action: z.enum(ACTIONS),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
  handler: async (input, ctx) => {
    const cookieId = input.cookieId ?? newCookieId();
    const cookieJar = await cookies();
    const value = JSON.stringify({
      cookieId,
      analytics: input.analytics,
      marketing: input.marketing,
      version: POLICY_VERSION,
    });
    cookieJar.set({
      name: COOKIE_NAME,
      value: encodeURIComponent(value),
      // 13-month expiry — the EDPB recommends ≤ 13 months.
      maxAge: 60 * 60 * 24 * 30 * 13,
      httpOnly: false, // banner reads the cookie client-side
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    await insertRow("CookieConsent", {
      cookieId,
      userId: ctx.user?.id ?? null,
      categories: JSON.stringify({
        necessary: true,
        analytics: input.analytics,
        marketing: input.marketing,
      }),
      action: input.action,
      policyVersion: POLICY_VERSION,
      ipHash: ctx.ipHash ?? null,
      userAgent: ctx.userAgent?.slice(0, 240) ?? null,
    });

    return { ok: true as const, cookieId };
  },
});
