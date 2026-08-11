/**
 * Notification digest worker — runs hourly via Vercel Cron (or any
 * other scheduler) and emails each user a roll-up of unread
 * notifications since their last digest.
 *
 * Frequency policy:
 *   - "instant" : skip the digest entirely (notifications already sent).
 *   - "daily"   : compile once per UTC day, send around 09:00 local.
 *   - "weekly"  : compile once per Monday, send around 09:00 local.
 *   - "off"     : never email; in-app only.
 *
 * Today the user preference doesn't exist yet — we default to "daily"
 * for CUSTOMER + PARTNER and "off" for others. Move the preference
 * onto `User` in a follow-up slice; this worker reads via the helper
 * `getDigestPreference(user)` so the upgrade is local.
 *
 * The worker is intentionally side-effect-light:
 *   - Reads `Notification.read=false AND createdAt > lastDigestAt`.
 *   - Renders one email (via `sendEmail`) per recipient.
 *   - Updates `User.lastDigestAt` so the next run picks up where it
 *     stopped.
 *
 * Idempotency: re-running the worker within the same hour is safe; the
 * `lastDigestAt` watermark guarantees no double-send.
 */

import "server-only";
import { query, updateRows } from "@/lib/db";
import { sendEmail } from "@/lib/email/provider";

export interface DigestRunResult {
  considered: number;
  sent: number;
  skipped: number;
  failures: number;
}

type DigestFrequency = "instant" | "daily" | "weekly" | "off";

/**
 * Today returns the role-based default. Once `User.digestFrequency`
 * lands, read it here.
 */
function getDigestPreference(role: string): DigestFrequency {
  if (role === "CUSTOMER" || role === "PARTNER") return "daily";
  if (role === "ADMIN") return "weekly";
  return "off";
}

/** Has the user not been digested today (or this week)? */
function isDue(frequency: DigestFrequency, lastDigestAt: Date | null): boolean {
  if (frequency === "off" || frequency === "instant") return false;
  if (!lastDigestAt) return true;
  const now = Date.now();
  const last = lastDigestAt.getTime();
  if (frequency === "daily") return now - last > 1000 * 60 * 60 * 20; // ≥ 20h
  if (frequency === "weekly") return now - last > 1000 * 60 * 60 * 24 * 6;
  return false;
}

function renderDigest(notifications: {
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  createdAt: Date;
}[]): { subject: string; body: string } {
  const count = notifications.length;
  const subject =
    count === 1
      ? `1 update for you on AI Partner`
      : `${count} updates for you on AI Partner`;

  const lines: string[] = [];
  lines.push("Hi,", "");
  lines.push(`Here's what happened since your last digest:`);
  lines.push("");
  for (const n of notifications.slice(0, 20)) {
    lines.push(`• ${n.title}`);
    if (n.message) lines.push(`  ${n.message.slice(0, 200)}`);
    if (n.link) lines.push(`  → https://aipartner.cloud${n.link}`);
    lines.push("");
  }
  if (count > 20) {
    lines.push(`…and ${count - 20} more in your inbox.`);
    lines.push("");
  }
  lines.push("— AI Partner");
  return { subject, body: lines.join("\n") };
}

/**
 * One pass of the digest. Caller is expected to run it on a schedule.
 * Returns counts for observability.
 */
export async function runDigest(): Promise<DigestRunResult> {
  // Pull every user with at least one unread notification — cheap
  // filter that keeps the inner loop bounded.
  const users = await query<{
    id: string;
    email: string;
    role: string;
    lastDigestAt: Date | null;
  }>(
    `SELECT u."id", u."email", u."role", u."lastDigestAt"
     FROM "User" u
     WHERE EXISTS (
       SELECT 1 FROM "Notification" n
       WHERE n."userId" = u."id" AND n."read" = FALSE
     )`,
  );

  let considered = 0;
  let sent = 0;
  let skipped = 0;
  let failures = 0;

  for (const user of users) {
    considered++;
    const pref = getDigestPreference(user.role);
    if (!isDue(pref, user.lastDigestAt)) {
      skipped++;
      continue;
    }

    const since = user.lastDigestAt ?? new Date(0);
    const notifications = await query<{
      type: string;
      title: string;
      message: string;
      link: string | null;
      createdAt: Date;
    }>(
      `SELECT "type", "title", "message", "link", "createdAt"
       FROM "Notification"
       WHERE "userId" = $1 AND "read" = FALSE AND "createdAt" > $2
       ORDER BY "createdAt" DESC LIMIT 50`,
      [user.id, since],
    );
    if (notifications.length === 0) {
      skipped++;
      continue;
    }

    const { subject, body } = renderDigest(notifications);
    try {
      await sendEmail({
        toAddress: user.email,
        subject,
        body,
        kind: "digest",
      });
      await updateRows("User", { id: user.id }, { lastDigestAt: new Date() });
      sent++;
    } catch (err) {
      failures++;
      // eslint-disable-next-line no-console
      console.warn("[digest] send failed", user.email, err);
    }
  }

  return { considered, sent, skipped, failures };
}
