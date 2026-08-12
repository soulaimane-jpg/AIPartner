import Link from "next/link";
import { redirect } from "next/navigation";
import { MailX, UserX } from "lucide-react";
import { auth } from "@/lib/auth";
import { acceptWorkspaceInviteAction } from "@/lib/actions/workspace-invites";
import { queryOne } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join workspace · AI Partner" };

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

  // On success the action redirects to /dashboard, so anything returned
  // here is a failure we have to explain. It used to redirect to
  // /workspace-invite/invalid — which matches this same dynamic route,
  // so an expired invite bounced between the page and itself forever.
  const result = await acceptWorkspaceInviteAction(token);

  const expired = result.reason === "expired";
  const Icon = expired ? MailX : UserX;

  return (
    <div className="mx-auto max-w-md py-16 text-center space-y-4">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="text-[22px] font-semibold tracking-tight">
        {expired ? "This invite has expired" : "Wrong account"}
      </h1>
      <p className="text-[13.5px] text-muted-foreground">
        {expired
          ? "Workspace invites are valid for 7 days and can only be used once. Ask a workspace owner to send you a new one."
          : `This invite was sent to a different email address. Sign in as the invited account, or ask for a new invite for ${session.user.email ?? "your address"}.`}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        {!expired && (
          <Button asChild variant="outline">
            <Link href="/auth/sign-in">Switch account</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
