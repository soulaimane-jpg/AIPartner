import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, FileEdit, Share2, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/constants";
import type { BriefStage } from "@/lib/enums";

export const dynamic = "force-dynamic";

/**
 * Roles are stored as free-text, and rows created before the two-role
 * (VIEWER/EDITOR) model may still carry REVIEWER/APPROVER. Treat any
 * non-viewer role as an editor so legacy rows still render a label.
 */
function ROLE_LABEL(role: string): string {
  return role === "VIEWER" ? "Viewer" : "Editor";
}

export default async function SharedBriefsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/auth/sign-in?next=/briefs/shared");
  }

  const userEmail = session.user.email.toLowerCase();

  // Incoming — briefs other people shared with me.
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
    approvedAt: Date | null;
    rejectedAt: Date | null;
    reviewNote: string | null;
  }>(
    `SELECT bc."id", bc."role", bc."status", bc."inviteToken", bc."briefId",
            bc."approvedAt", bc."rejectedAt", bc."reviewNote",
            b."title" AS "briefTitle", b."stage" AS "briefStage",
            u."name" AS "ownerName", u."email" AS "ownerEmail"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     WHERE lower(bc."email") = $1 AND bc."status" <> 'REMOVED'
     ORDER BY bc."updatedAt" DESC`,
    [userEmail],
  );

  // Outgoing — briefs I own that I've shared with other people, so I can see
  // who still owes me notes or a decision.
  const outgoing = await query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    briefId: string;
    briefTitle: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    reviewNote: string | null;
  }>(
    `SELECT bc."id", bc."email", bc."name", bc."role", bc."status", bc."briefId",
            bc."approvedAt", bc."rejectedAt", bc."reviewNote",
            b."title" AS "briefTitle"
     FROM "BriefCollaborator" bc
     JOIN "ProjectBrief" b ON b."id" = bc."briefId"
     WHERE b."ownerId" = $1 AND bc."status" <> 'REMOVED'
     ORDER BY bc."updatedAt" DESC`,
    [session.user.id],
  );

  return (
    <div className="page-container portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden>
            <FolderKanban className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">Collaboration</div>
            <h1 className="portal-page-title">Shared Briefs</h1>
            <p className="portal-page-description">
              Briefs you shared for review and briefs colleagues shared with you.
            </p>
          </div>
        </div>
      </header>

      {/* Sub-tab navigation */}
      <nav className="flex items-center gap-1 border-b border-border mb-6">
        <Link
          href="/briefs"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileEdit className="h-3.5 w-3.5" />
          Create Briefs
        </Link>
        <Link
          href="/briefs/shared"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 border-primary text-primary transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          Shared Briefs
        </Link>
      </nav>

      {/* ── Shared by you ─────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          Shared by you
        </h2>
        <p className="text-[12.5px] text-muted-foreground mb-3">
          People you invited to review your Statements of Work.
        </p>

        {outgoing.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-elev-1">
            <p className="text-[13.5px] text-muted-foreground">
              You haven&apos;t shared any briefs yet. Invite a colleague from the
              brief&apos;s review section to collect their notes or approval.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((c) => {
              const roleLabel = ROLE_LABEL(c.role);
              const statusBadge =
                c.approvedAt ? (
                  <Badge variant="success" className="text-[10px]">Approved</Badge>
                ) : c.rejectedAt ? (
                  <Badge tone="danger" className="text-[10px]">Rejected</Badge>
                ) : c.status === "INVITED" ? (
                  <Badge variant="warning" className="text-[10px]">Invite pending</Badge>
                ) : (
                  <Badge variant="warning" className="text-[10px]">Awaiting review</Badge>
                );

              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-line bg-card shadow-elev-1 transition-[border-color,box-shadow] duration-160 hover:border-border-strong hover:shadow-elev-2"
                >
                  <Link
                    href={`/briefs/${c.briefId}/preview#collaborators`}
                    className="block p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-foreground truncate">
                            {c.briefTitle}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-brand-1/8 text-brand-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                            {roleLabel}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Shared with {c.name ?? c.email}
                        </p>
                        {c.reviewNote && (
                          <p className="mt-2 text-[12.5px] text-foreground bg-surface-1 rounded-md p-2.5 border border-line">
                            <span className="text-muted-foreground">Their note: </span>
                            {c.reviewNote}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {statusBadge}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Shared with you ───────────────────────────────────────── */}
      <section>
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          Shared with you
        </h2>
        <p className="text-[12.5px] text-muted-foreground mb-3">
          Briefs colleagues invited you to review or approve.
        </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-elev-1">
          <p className="text-[13.5px] text-muted-foreground">
            When a colleague invites you to review or approve a Statement of Work,
            it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const inviter = c.ownerName ?? c.ownerEmail ?? "A colleague";
            const roleLabel = ROLE_LABEL(c.role);
            const stageLabel =
              STAGE_LABELS[c.briefStage as BriefStage] ?? c.briefStage;
            const statusBadge =
              c.status === "INVITED" ? (
                <Badge variant="warning" className="text-[10px]">Awaiting acceptance</Badge>
              ) : c.approvedAt ? (
                <Badge variant="success" className="text-[10px]">Approved</Badge>
              ) : c.rejectedAt ? (
                <Badge tone="danger" className="text-[10px]">Rejected</Badge>
              ) : (
                <Badge variant="default" className="text-[10px]">{stageLabel}</Badge>
              );

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
                  className="block p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-foreground truncate">
                          {c.briefTitle}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-brand-1/8 text-brand-1 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                          {roleLabel}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Shared by {inviter}
                      </p>
                      {c.reviewNote && (
                        <p className="mt-2 text-[12.5px] text-foreground bg-surface-1 rounded-md p-2.5 border border-line">
                          <span className="text-muted-foreground">Review note: </span>
                          {c.reviewNote}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {statusBadge}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </section>
    </div>
  );
}
