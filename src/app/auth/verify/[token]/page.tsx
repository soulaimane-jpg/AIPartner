import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { exec, queryOne, updateRows } from "@/lib/db";
import {
  findUsableVerificationToken,
  hashVerificationToken,
} from "@/lib/auth/email-verification";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Confirm your email · AI Partner" };

// The token is checked against the database on every view, so this page
// can never be cached.
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await findUsableVerificationToken(token);

  if (row) {
    // Single-use: burn the token in the same request that verifies.
    await updateRows("User", { id: row.userId }, { emailVerified: new Date() });
    await exec(
      `UPDATE "EmailVerificationToken" SET "usedAt" = NOW() WHERE "id" = $1`,
      [row.id],
    );
  }

  // A token that has already been used still shows success if the account
  // ended up verified — re-clicking the link shouldn't look like a failure.
  const alreadyVerified =
    !row && token.length >= 16
      ? Boolean(
          await queryOne<{ id: string }>(
            `SELECT u."id" FROM "EmailVerificationToken" t
               JOIN "User" u ON u."id" = t."userId"
              WHERE t."tokenHash" = $1 AND u."emailVerified" IS NOT NULL`,
            [hashVerificationToken(token)],
          ).catch(() => null),
        )
      : false;

  const ok = Boolean(row) || alreadyVerified;

  return (
    <div className="mx-auto max-w-md py-16 text-center space-y-4">
      {ok ? (
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
      ) : (
        <XCircle className="mx-auto h-10 w-10 text-danger" />
      )}
      <h1 className="text-[22px] font-semibold tracking-tight">
        {ok ? "Email confirmed" : "This link has expired"}
      </h1>
      <p className="text-[13.5px] text-muted-foreground">
        {ok
          ? "Thanks — your email address is verified."
          : "Confirmation links are valid for 48 hours and can only be used once. Sign in and send yourself a new one from your profile."}
      </p>
      <Button asChild>
        <Link href={ok ? "/dashboard" : "/profile"}>
          {ok ? "Go to dashboard" : "Go to profile"}
        </Link>
      </Button>
    </div>
  );
}
