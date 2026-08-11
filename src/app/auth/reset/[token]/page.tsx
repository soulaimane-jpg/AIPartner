import {
  CompletePasswordResetForm,
  ExpiredResetLink,
} from "@/components/auth/password-reset-forms";
import { isPasswordResetTokenValid } from "@/lib/auth/password-reset";

export const metadata = { title: "Choose a new password · AI Partner" };

// The token is checked against the database on every view, so this page can
// never be cached.
export const dynamic = "force-dynamic";

export default async function CompletePasswordResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate up front so an expired link shows a clear recovery path instead
  // of failing only after the user has typed a new password.
  const valid = await isPasswordResetTokenValid(token);
  if (!valid) return <ExpiredResetLink />;

  return <CompletePasswordResetForm token={token} />;
}
