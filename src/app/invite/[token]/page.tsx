import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { claimCollaboratorInviteAction } from "@/lib/actions/collaborators";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're invited · AI Partner" };

/**
 * Magic-link landing for brief-collaborator invites. If the visitor is
 * not signed in we send them to sign-up with the invite email pre-filled
 * (and the invite token preserved for post-sign-in claim).
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await queryOne<{
    email: string;
    role: string;
    briefTitle: string;
    inviterName: string | null;
    inviterEmail: string | null;
  }>(
    `SELECT bc."email", bc."role",
            b."title" AS "briefTitle",
            u."name" AS "inviterName", u."email" AS "inviterEmail"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     LEFT JOIN "User" u ON u."id" = bc."invitedById"
     WHERE bc."inviteToken" = $1`,
    [token],
  );

  if (!invite) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-[22px] font-semibold tracking-tight">Invite invalid</h1>
          <p className="text-[13.5px] text-muted-foreground">
            This invitation link has been revoked or never existed. Ask your
            colleague to send a new one.
          </p>
          <Button asChild variant="outline" size="md">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const session = await auth();

  // Not signed in → ship them to sign-up with the email pre-filled. After
  // signup the middleware survey-gate kicks in, then they come back here.
  if (!session?.user?.id) {
    const signUpUrl = new URL("https://placeholder/auth/sign-up");
    signUpUrl.searchParams.set("next", `/invite/${token}`);
    signUpUrl.searchParams.set("email", invite.email);
    redirect(signUpUrl.pathname + signUpUrl.search);
  }

  // Signed in but wrong account.
  if ((session.user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Wrong account
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            This invite was sent to <b>{invite.email}</b>. Sign in with that
            email to accept.
          </p>
          <Button asChild variant="default" size="md">
            <Link href={`/auth/sign-in?next=/invite/${token}`}>Switch account</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Signed in and matching — claim and forward.
  async function handleAccept() {
    "use server";
    const result = await claimCollaboratorInviteAction(token);
    redirect(`/briefs/${result.briefId}/preview`);
  }

  const role =
    invite.role === "EDITOR"
      ? "review and edit"
      : "view";
  const inviter = invite.inviterName || invite.inviterEmail || "Your colleague";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form action={handleAccept} className="max-w-md w-full text-center space-y-5 rounded-2xl border border-line bg-card p-8 shadow-elev-2">
        <div className="grid h-14 w-14 mx-auto place-items-center rounded-xl bg-brand-1/10 text-brand-1">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-[22px] font-semibold tracking-tight">
            {inviter} invited you to {role} a project brief
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            <span className="font-medium text-foreground">{invite.briefTitle}</span>
            {" · "}
            You&apos;ll be added as <b>{invite.role.toLowerCase()}</b>.
          </p>
        </div>
        <Button type="submit" size="md" className="w-full">
          <ArrowRight className="h-3.5 w-3.5" />
          Accept & open brief
        </Button>
      </form>
    </div>
  );
}
