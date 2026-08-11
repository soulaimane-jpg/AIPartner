/**
 * Google Calendar integration for admin-scheduled meetings.
 *
 * One module owns:
 *   1. The OAuth2 client config (web app flow, separate from NextAuth).
 *   2. The token store — encrypted at rest via `encryptString`.
 *   3. A `getCalendarClientForAdmin(userId)` that resolves a ready-to-use
 *      `calendar_v3.Calendar` instance with auto-refreshed credentials.
 *   4. Helpers to create / cancel calendar events with Meet links.
 *
 * Tokens live in the `GoogleCalendarToken` table — one row per admin who
 * connected their Google Calendar. We refresh access tokens lazily when
 * the cached one is within 60s of expiry.
 *
 * Why a dedicated OAuth web client (not the NextAuth sign-in client)?
 *   - The Calendar scope is sensitive and we don't want every Google
 *     sign-in (customer / googler) to be prompted for it.
 *   - The admin opts in once via "Connect Google Calendar" — we then
 *     persist the refresh token and reuse it for every future meeting.
 */

import "server-only";
import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import type { GoogleCalendarTokenRow } from "@/lib/db/rows";
import { env } from "@/env";
import { encryptString, decryptString } from "@/lib/crypto";

/**
 * OAuth scopes we request for admins. `calendar.events` is the minimal
 * scope needed to create + update events on the admin's primary calendar
 * (Meet links auto-generate when `conferenceData` is set).
 */
export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

/** Public URL of this app — used to build the OAuth redirect URI. */
function appUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/** Canonical redirect URI registered in the GCP OAuth client. */
export function redirectUri(): string {
  return `${appUrl()}/api/admin/google/callback`;
}

/** True when both OAuth client envs are configured. */
export function isCalendarConfigured(): boolean {
  return Boolean(
    env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
}

/** Build a fresh OAuth2 client. Never share these across requests. */
function buildOAuthClient(): OAuth2Client {
  if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    throw new Error(
      "Google Calendar OAuth client not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.",
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CALENDAR_CLIENT_ID,
    env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri(),
  );
}

/**
 * Generate the consent URL the admin is redirected to.
 *
 * @param state Opaque value echoed back to us in the callback — used as
 *              a CSRF token (we cross-check it against a signed cookie).
 */
export function buildAuthUrl(state: string): string {
  const oauth2 = buildOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline", // forces a refresh_token on first consent
    // "select_account" shows the account chooser (so the admin can pick
    // WHICH Google account to connect instead of Google silently
    // auto-selecting the only active session); "consent" guarantees a
    // refresh_token is returned even on re-consent.
    prompt: "select_account consent",
    scope: [...CALENDAR_SCOPES],
    include_granted_scopes: true,
    state,
  });
}

/** Exchange the auth code for tokens and persist them encrypted. */
export async function exchangeCodeAndStore(
  code: string,
  adminUserId: string,
): Promise<{ accountEmail: string | null }> {
  const oauth2 = buildOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access_token.");
  }
  // Fetch the email of the connected account so the UI can display it.
  oauth2.setCredentials(tokens);
  let accountEmail: string | null = null;
  try {
    const me = await google
      .oauth2({ version: "v2", auth: oauth2 })
      .userinfo.get();
    accountEmail = me.data.email ?? null;
  } catch {
    accountEmail = null;
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 55 * 60 * 1000);

  await insertRow(
    "GoogleCalendarToken",
    {
      userId: adminUserId,
      accessTokenCipher: encryptString(tokens.access_token),
      refreshTokenCipher: tokens.refresh_token
        ? encryptString(tokens.refresh_token)
        : null,
      expiresAt,
      scope: tokens.scope ?? CALENDAR_SCOPES.join(" "),
      accountEmail,
    },
    {
      // Only overwrite refresh token if Google gave us a new one — they
      // omit it on subsequent consents unless prompt=consent forced it.
      onConflict: `("userId") DO UPDATE SET
        "accessTokenCipher" = EXCLUDED."accessTokenCipher",
        "refreshTokenCipher" = COALESCE(EXCLUDED."refreshTokenCipher", "GoogleCalendarToken"."refreshTokenCipher"),
        "expiresAt" = EXCLUDED."expiresAt",
        "scope" = EXCLUDED."scope",
        "accountEmail" = EXCLUDED."accountEmail",
        "updatedAt" = EXCLUDED."updatedAt"`,
    },
  );

  return { accountEmail };
}

/**
 * Resolve a `calendar_v3.Calendar` client authenticated for the given
 * admin. Refreshes the access token transparently when it's expired
 * (or about to expire within the next 60 seconds).
 *
 * Returns `null` when the admin hasn't connected their calendar yet.
 */
export async function getCalendarClientForAdmin(
  adminUserId: string,
): Promise<calendar_v3.Calendar | null> {
  const row = await queryOne<GoogleCalendarTokenRow>(
    'SELECT * FROM "GoogleCalendarToken" WHERE "userId" = $1',
    [adminUserId],
  );
  if (!row) return null;

  const oauth2 = buildOAuthClient();
  let accessToken = decryptString(row.accessTokenCipher);
  const refreshToken = row.refreshTokenCipher
    ? decryptString(row.refreshTokenCipher)
    : null;

  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: row.expiresAt.getTime(),
  });

  // Proactive refresh — within 60s of expiry, ask for a new access token.
  const needsRefresh =
    row.expiresAt.getTime() - Date.now() < 60_000 && refreshToken;
  if (needsRefresh) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token) {
        accessToken = credentials.access_token;
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 55 * 60 * 1000);
        await updateRows(
          "GoogleCalendarToken",
          { userId: adminUserId },
          {
            accessTokenCipher: encryptString(accessToken),
            expiresAt: newExpiry,
            ...(credentials.refresh_token
              ? {
                  refreshTokenCipher: encryptString(credentials.refresh_token),
                }
              : {}),
          },
        );
        oauth2.setCredentials(credentials);
      }
    } catch (err) {
      // Refresh failed — surface as "not connected" so the UI can
      // prompt re-auth. Don't throw, callers branch on null.
      // eslint-disable-next-line no-console
      console.warn("[google-calendar] token refresh failed", err);
      return null;
    }
  }

  return google.calendar({ version: "v3", auth: oauth2 });
}

/** Input to `createCalendarEvent`. */
export interface CreateEventInput {
  adminUserId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  /** IANA timezone, e.g. "Europe/Amsterdam". */
  timeZone: string;
  /** Attendee emails — invitees Google will email an ICS to. */
  attendees: { email: string; displayName?: string | null }[];
}

export interface CreateEventResult {
  eventId: string;
  htmlLink: string | null;
  meetLink: string | null;
}

/**
 * Create a calendar event with a Google Meet conference. Sends real
 * email invites to all attendees via `sendUpdates: "all"`.
 *
 * Throws if the admin hasn't connected their calendar — the caller
 * should pre-check with `getCalendarClientForAdmin` and surface a
 * friendlier "Connect Google Calendar" CTA.
 */
export async function createCalendarEvent(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const cal = await getCalendarClientForAdmin(input.adminUserId);
  if (!cal) {
    throw new Error("Google Calendar is not connected for this admin.");
  }

  // Stable, idempotency-friendly requestId for Meet conference creation.
  const requestId = `aip-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const res = await cal.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    conferenceDataVersion: 1,
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone },
      attendees: input.attendees
        .filter((a) => a.email && a.email.includes("@"))
        .map((a) => ({ email: a.email, displayName: a.displayName ?? undefined })),
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: { useDefault: true },
    },
  });

  const event = res.data;
  // Pull out the Meet URL from conferenceData.entryPoints (kind="video").
  const meetEntry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video",
  );

  return {
    eventId: event.id ?? "",
    htmlLink: event.htmlLink ?? null,
    meetLink: meetEntry?.uri ?? event.hangoutLink ?? null,
  };
}

/**
 * Cancel (delete) the underlying Google Calendar event. Best-effort —
 * the caller should still flip the local `Meeting.status` to CANCELLED
 * even if Google fails (network blips, manual deletion already done).
 */
export async function cancelCalendarEvent(
  adminUserId: string,
  eventId: string,
): Promise<void> {
  const cal = await getCalendarClientForAdmin(adminUserId);
  if (!cal) return;
  try {
    await cal.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });
  } catch (err) {
    // 404/410 mean the event is already gone — that's fine.
    const code = (err as { code?: number }).code;
    if (code === 404 || code === 410) return;
    throw err;
  }
}
