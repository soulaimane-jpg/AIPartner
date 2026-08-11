import "server-only";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import { sendEmail } from "@/lib/email/provider";

/**
 * Send (or, today, persist) an outreach email. This is the single seam
 * to swap in a real provider later — every call site funnels through it.
 *
 * Lives in its own server-only module (separate from the pure
 * `@/lib/email-templates` renderers) so client components can import the
 * template helpers without pulling the DB layer into their bundle.
 *
 * Current behaviour:
 *   • Writes the rendered subject + body onto `Match.mockEmailBody`
 *   • If the recipient already has a User record, creates an in-app
 *     Notification pointing to the partner brief
 */
export async function sendOutreachEmail(opts: {
  matchId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  notification?: {
    type: string;
    title: string;
    message: string;
    link?: string;
  };
}): Promise<void> {
  const { matchId, recipientEmail, subject, body, notification } = opts;
  const fullBody = `Subject: ${subject}\nTo: ${recipientEmail}\n\n${body}`;

  await updateRows(
    "Match",
    { id: matchId },
    {
      mockEmailBody: fullBody,
      outreachEmail: recipientEmail,
      outreachSentAt: new Date(),
    },
  );

  // Deliver through the shared provider seam. In mock mode this only
  // persists to `Email`; with SMTP/Resend configured it actually sends.
  // The Match transcript is already saved, so a send failure is non-fatal.
  try {
    await sendEmail({
      toAddress: recipientEmail,
      subject,
      body,
      kind: "partner-outreach",
      matchId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[partner-outreach] email send failed:", err);
  }

  if (notification) {
    const user = await queryOne<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "email" = $1',
      [recipientEmail.toLowerCase()],
    );
    if (user) {
      await insertRow("Notification", {
        userId: user.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link ?? null,
      });
    }
  }
}
