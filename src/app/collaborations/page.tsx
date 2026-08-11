import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, Plus, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { UpgradeToCustomerDialog } from "./_components/upgrade-dialog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your collaborations · AI Partner" };

/**
 * COLLABORATOR landing page.
 *
 * Lists every brief the signed-in user has been invited to. This replaces
 * the customer `/dashboard` for users created via invite, since they have
 * no `Company` of their own and no `brief.create` rights.
 *
 * If the user wants to start their own project, the "Start your own
 * project" CTA opens an upgrade dialog that promotes them to `CUSTOMER`.
 *
 * Customers can also navigate here directly — for them it acts as a
 * read-only inventory of cross-tenant briefs they collaborate on (in
 * addition to their main /dashboard).
 */
export default async function CollaborationsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/auth/sign-in?next=/collaborations");
  }

  const rows = await query<{
    id: string;
    role: string;
    status: string;
    inviteToken: string;
    briefId: string;
    briefTitle: string;
    briefStage: string;
    ownerName: string | null;
    ownerEmail: string | null;
  }>(
    `SELECT bc."id", bc."role", bc."status", bc."inviteToken", bc."briefId",
            b."title" AS "briefTitle", b."stage" AS "briefStage",
            u."name" AS "ownerName", u."email" AS "ownerEmail"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     WHERE bc."email" = $1 AND bc."status" <> 'REMOVED'
     ORDER BY bc."updatedAt" DESC`,
    [session.user.email.toLowerCase()],
  );

  const isCollaboratorOnly = session.user.role === "COLLABORATOR";
  const firstName = (session.user.name ?? "").split(/\s+/)[0] || "there";

  return (
    <div className="space-y-6">
      <header className="portal-page-header">
        <div>
          <div className="eyebrow">Collaborations</div>
          <h1 className="portal-page-title">Hi {firstName}.</h1>
          <p className="portal-page-description">
            {isCollaboratorOnly
              ? "You've been invited to collaborate on the project briefs below. You'll only see briefs explicitly shared with you — no other data on the platform."
              : "Briefs other workspaces have shared with you. Your own briefs live on the main dashboard."}
          </p>
        </div>
        {isCollaboratorOnly && (
          <div className="w-full sm:w-auto">
            <UpgradeToCustomerDialog />
          </div>
        )}
      </header>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-8 text-center">
            <p className="text-[14px] text-muted-foreground">
              You haven&apos;t been invited to any briefs yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((c) => {
              const inviter = c.ownerName ?? c.ownerEmail ?? "A colleague";
              const roleLabel =
                c.role === "EDITOR"
                  ? "Editor"
                  : "Viewer";
              const statusLabel =
                c.status === "INVITED" ? "Awaiting your acceptance" : c.briefStage;
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-line bg-card shadow-elev-1 transition-[border-color,box-shadow] duration-160 hover:border-border-strong hover:shadow-elev-2"
                >
                  <Link
                    href={
                      c.status === "INVITED"
                        ? `/invite/${c.inviteToken}`
                        : `/briefs/${c.briefId}/preview`
                    }
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-medium text-foreground truncate">
                            {c.briefTitle}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-primary/8 text-primary px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                            {roleLabel}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Invited by {inviter} · {statusLabel.toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {isCollaboratorOnly && rows.length > 0 && (
          <div className="rounded-xl border border-dashed border-line bg-card/50 p-5 flex items-start gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-[13.5px] font-medium text-foreground">
                Want to scope your own Google Cloud project?
              </p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                Turn this account into a full customer workspace so you can
                create your own Statement of Work and match with partners.
              </p>
            </div>
            <UpgradeToCustomerDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  Start your own project
                </Button>
              }
            />
          </div>
        )}
    </div>
  );
}
