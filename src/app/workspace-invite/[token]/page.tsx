import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { acceptWorkspaceInviteAction } from "@/lib/actions/workspace-invites";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkspaceInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    const crypto = await import("node:crypto");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const invite = await queryOne<{ email: string }>(
      `SELECT "email" FROM "WorkspaceInvite" WHERE "tokenHash" = $1 AND "status" = 'INVITED' AND "expiresAt" > NOW()`,
      [tokenHash],
    );
    const qs = new URLSearchParams({ next: `/workspace-invite/${token}` });
    if (invite?.email) qs.set("email", invite.email);
    redirect(`/auth/sign-up?${qs.toString()}`);
  }
  await acceptWorkspaceInviteAction(token);
  return null;
}
