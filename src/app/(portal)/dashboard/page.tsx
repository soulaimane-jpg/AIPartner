import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { computeCompletion } from "@/lib/brief";
import { safeJsonParse } from "@/lib/utils";
import type { BriefStage, BriefStatus, ServiceCategory } from "@/lib/enums";
import { buildCustomerDashboardAnalytics } from "@/lib/customer-dashboard";
import { WorkspaceClient } from "./_components/workspace-client";
import type { WorkspaceBrief } from "./_components/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · AI Partner" };

export default async function CustomerWorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/dashboard");

  // Fetch every brief the customer owns along with the relations we
  // surface in cards / drawers (proposals, matches).
  const [rows, proposalActivity, upcomingMeetingRows, sharedRows] = await Promise.all([
    query<
      ProjectBriefRow & {
        proposalsCount: number;
        matchesCount: number;
        sourcedMatches: number;
      }
    >(
      `SELECT b.*,
         (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id" AND p."releasedAt" IS NOT NULL)::int AS "proposalsCount",
         (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id")::int AS "matchesCount",
         (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id" AND m."status" = 'SOURCED')::int AS "sourcedMatches"
       FROM "ProjectBrief" b
       WHERE b."ownerId" = $1
       ORDER BY b."updatedAt" DESC`,
      [session.user.id],
    ),
    query<{ submittedAt: Date }>(
      `SELECT p."releasedAt" AS "submittedAt"
       FROM "Proposal" p
       JOIN "ProjectBrief" b ON b."id" = p."briefId"
       WHERE b."ownerId" = $1 AND p."releasedAt" IS NOT NULL
       ORDER BY p."releasedAt" ASC`,
      [session.user.id],
    ),
    query<{
      id: string;
      title: string;
      startsAt: Date;
      endsAt: Date;
      timeZone: string;
      meetLink: string | null;
    }>(
      `SELECT m."id", m."title", m."startsAt", m."endsAt", m."timeZone", m."meetLink"
       FROM "Meeting" m
       WHERE m."customerUserId" = $1
         AND m."status" = 'SCHEDULED'
         AND m."endsAt" >= NOW()
       ORDER BY m."startsAt" ASC
       LIMIT 4`,
      [session.user.id],
    ),
    session.user.email
      ? query<{
          id: string;
          briefId: string;
          role: string;
          briefTitle: string;
          briefOwnerId: string;
          ownerName: string | null;
          ownerEmail: string | null;
        }>(
          `SELECT bc."id", bc."briefId", bc."role",
                  b."title" AS "briefTitle", b."ownerId" AS "briefOwnerId",
                  u."name" AS "ownerName", u."email" AS "ownerEmail"
           FROM "BriefCollaborator" bc
           JOIN "ProjectBrief" b ON b."id" = bc."briefId"
           LEFT JOIN "User" u ON u."id" = b."ownerId"
           WHERE bc."email" = $1 AND bc."status" = 'ACTIVE'
           ORDER BY bc."updatedAt" DESC
           LIMIT 6`,
          [session.user.email.toLowerCase()],
        )
      : Promise.resolve([]),
  ]);

  // Shape into the serializable form consumed by the client UI.
  const briefs: WorkspaceBrief[] = rows.map((b) => {
    const services = safeJsonParse<ServiceCategory[]>(b.services, []);
    const completion = computeCompletion(b);
    const proposalsCount = b.proposalsCount;
    const matchesCount = b.matchesCount;

    // "Needs decision" rules:
    //   • REVIEW stage with sourced matches awaiting customer approval
    //   • SELECTION stage with at least one proposal to compare
    //   • PROPOSALS stage where all approved partners have submitted
    const sourcedMatches = b.sourcedMatches;
    const hasActionRequired =
      (b.stage === "REVIEW" && sourcedMatches > 0) ||
      (b.stage === "SELECTION" && proposalsCount > 0) ||
      (b.stage === "PROPOSALS" && proposalsCount > 0);

    return {
      id: b.id,
      title: b.title,
      stage: b.stage as BriefStage,
      status: b.status as BriefStatus,
      completion,
      proposalsCount,
      matchesCount,
      hasActionRequired,
      services,
      targetGoLive: b.targetGoLive ?? null,
      budgetRange: b.budgetRange ?? null,
      updatedAt: b.updatedAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    };
  });

  const analytics = buildCustomerDashboardAnalytics({
    briefs,
    proposals: proposalActivity,
  });
  const upcomingMeetings = upcomingMeetingRows.map((meeting) => ({
    ...meeting,
    startsAt: meeting.startsAt.toISOString(),
    endsAt: meeting.endsAt.toISOString(),
  }));

  const firstName = (session.user.name ?? "").split(/\s+/)[0] || "there";
  const greeting = greetingFor(firstName);

  // "Shared with me" — briefs the user collaborates on but doesn't own.
  // These typically come from cross-tenant invites (a different customer
  // added them as a reviewer/approver on their SoW). We only show ACTIVE
  // ones (already accepted); pending invites still surface via the
  // /collaborations page.
  const shared = sharedRows.filter((r) => r.briefOwnerId !== session.user.id);

  return (
    <>
      {shared.length > 0 && (
        <div className="page-container-wide px-4 pt-6 sm:px-6 lg:px-8">
          <SharedWithMeStrip rows={shared} />
        </div>
      )}
      <WorkspaceClient
        briefs={briefs}
        analytics={analytics}
        upcomingMeetings={upcomingMeetings}
        greeting={greeting}
      />
    </>
  );
}

function SharedWithMeStrip({
  rows,
}: {
  rows: Array<{
    id: string;
    briefId: string;
    role: string;
    briefTitle: string;
    ownerName: string | null;
    ownerEmail: string | null;
  }>;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-4 mb-4">
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">
            Shared with me
          </h3>
          <span className="text-[11.5px] text-muted-foreground">
            {rows.length}
          </span>
        </div>
        <Link
          href="/collaborations"
          className="text-[12px] font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, 6).map((r) => {
          const inviter = r.ownerName ?? r.ownerEmail ?? "Colleague";
          const roleLabel =
            r.role === "EDITOR"
              ? "Editor"
              : "Viewer";
          return (
            <li key={r.id}>
              <Link
                href={`/briefs/${r.briefId}/preview`}
                className="block rounded-lg border border-line bg-card hover:bg-secondary/40 transition-colors p-3"
              >
                <p className="text-[13px] font-medium text-foreground truncate">
                  {r.briefTitle}
                </p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
                  {inviter} · {roleLabel}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function greetingFor(name: string): string {
  const h = new Date().getHours();
  const part = h < 5 ? "Up early" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}.`;
}
