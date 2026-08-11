import { RequestPasswordResetForm } from "@/components/auth/password-reset-forms";

export const metadata = { title: "Reset password · AI Partner" };

export default async function RequestPasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <RequestPasswordResetForm initialEmail={email ?? ""} />;
}
