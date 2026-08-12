import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { WorkspaceInviteForm } from "./workspace-invite-form";
import { JoinRequests } from "./join-requests";
import { listPendingJoinRequests } from "@/lib/workspace-discovery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace members · AI Partner" };

export default async function WorkspaceMembersPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");
  const membership = await queryOne<{ role: string }>(
    `SELECT "role" FROM "WorkspaceMembership" WHERE "companyId"=$1 AND "userId"=$2 AND "status"='ACTIVE'`,
    [session.user.companyId, session.user.id],
  );
  const canManage = membership?.role === "OWNER" || membership?.role === "ADMIN";
  const members = await query<{ id: string; name: string | null; email: string; role: string; joinedAt: Date }>(
    `SELECT wm."id", u."name", u."email", wm."role", wm."joinedAt"
     FROM "WorkspaceMembership" wm JOIN "User" u ON u."id"=wm."userId"
     WHERE wm."companyId"=$1 AND wm."status"='ACTIVE'
     ORDER BY CASE wm."role" WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, u."name"`,
    [session.user.companyId],
  );
  const invites = canManage ? await query<{ id: string; email: string; role: string; expiresAt: Date }>(
    `SELECT "id", "email", "role", "expiresAt" FROM "WorkspaceInvite" WHERE "companyId"=$1 AND "status"='INVITED' ORDER BY "createdAt" DESC`,
    [session.user.companyId],
  ) : [];
  const joinRequests = canManage
    ? await listPendingJoinRequests(session.user.companyId)
    : [];

  // Brief collaborators are a separate population from workspace members:
  // inviting someone to review a single SoW deliberately does NOT make them a
  // member of the workspace. They were invisible here, so an admin had no way
  // to audit who holds access to which brief.
  const collaboratorRows = await query<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    acceptedAt: Date | null;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    createdAt: Date;
    briefId: string;
    briefTitle: string;
    invitedByName: string | null;
    isMember: boolean;
  }>(
    `SELECT bc."id", bc."email", bc."name", bc."role", bc."status",
            bc."acceptedAt", bc."approvedAt", bc."rejectedAt", bc."createdAt",
            b."id" AS "briefId", b."title" AS "briefTitle",
            inviter."name" AS "invitedByName",
            EXISTS (
              SELECT 1 FROM "User" mu
                JOIN "WorkspaceMembership" mwm
                  ON mwm."userId" = mu."id"
                 AND mwm."companyId" = $1
                 AND mwm."status" = 'ACTIVE'
               WHERE lower(mu."email") = lower(bc."email")
            ) AS "isMember"
       FROM "BriefCollaborator" bc
       JOIN "ProjectBrief" b ON b."id" = bc."briefId"
       LEFT JOIN "User" inviter ON inviter."id" = bc."invitedById"
      WHERE b."companyId" = $1 AND bc."status" <> 'REMOVED'
      ORDER BY bc."createdAt" DESC`,
    [session.user.companyId],
  );

  // One person can hold access to several briefs — group so each guest is a
  // single row with all their grants underneath.
  const guests = new Map<
    string,
    {
      email: string;
      name: string | null;
      isMember: boolean;
      grants: typeof collaboratorRows;
    }
  >();
  for (const row of collaboratorRows) {
    const key = row.email.toLowerCase();
    const existing = guests.get(key);
    if (existing) {
      existing.name ??= row.name;
      existing.grants.push(row);
    } else {
      guests.set(key, {
        email: row.email,
        name: row.name,
        isMember: row.isMember,
        grants: [row],
      });
    }
  }

  return (
    <div className="page-container portal-page max-w-5xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <Users className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow">Settings</div>
            <h1 className="portal-page-title">Members</h1>
            <p className="portal-page-description">
              Manage company workspace membership. Brief visibility is granted
              separately per brief.
            </p>
          </div>
        </div>
      </header>

      {canManage && joinRequests.length > 0 && (
        <JoinRequests
          requests={joinRequests.map((r) => ({
            id: r.id,
            requesterName: r.requesterName,
            requesterEmail: r.requesterEmail,
            emailDomain: r.emailDomain,
          }))}
        />
      )}

      {canManage && <WorkspaceInviteForm />}

      <section className="customer-table">
        <div className="customer-panel-header text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Active members
        </div>
        <div className="divide-y divide-line">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">
                  {member.name ?? member.email}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {member.email}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {invites.length > 0 && (
        <section className="customer-table">
          <div className="customer-panel-header text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invitations
          </div>
          <div className="divide-y divide-line">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{invite.email}</div>
                  <div className="text-[12px] text-muted-foreground">
                    Expires {invite.expiresAt.toLocaleDateString()}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                  {invite.role}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="customer-table">
        <div className="customer-panel-header">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Brief access ({guests.size})
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              People invited to review a specific Statement of Work. Brief access is
              granted per brief and does not make someone a workspace member.
            </p>
          </div>
        </div>

        {guests.size === 0 ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground sm:px-6">
            Nobody has been invited to a brief yet. Invite a reviewer from a
            brief&apos;s review section to collect their notes or approval.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {[...guests.values()].map((guest) => (
              <div key={guest.email} className="px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {guest.name ?? guest.email}
                      </span>
                      {guest.isMember ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-medium">
                          Workspace member
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                          Guest
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {guest.email}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {guest.grants.length} brief{guest.grants.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {guest.grants.map((grant) => {
                    // Decision state is richer than `status`: an accepted reviewer
                    // may still owe a verdict, so approvedAt/rejectedAt win.
                    const state = grant.approvedAt
                      ? { label: "Approved", cls: "bg-emerald-50 text-emerald-800" }
                      : grant.rejectedAt
                        ? { label: "Rejected", cls: "bg-red-50 text-red-700" }
                        : grant.status === "INVITED"
                          ? { label: "Invite pending", cls: "bg-amber-50 text-amber-800" }
                          : { label: "Awaiting review", cls: "bg-amber-50 text-amber-800" };
                    return (
                      <li
                        key={grant.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-1 px-3 py-2"
                      >
                        <a
                          href={`/briefs/${grant.briefId}/preview`}
                          className="min-w-0 truncate text-[12.5px] font-medium text-foreground hover:underline"
                        >
                          {grant.briefTitle}
                        </a>
                        <span className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          <span className="rounded-full bg-brand-1/8 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-1">
                            {grant.role === "VIEWER" ? "Viewer" : "Editor"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${state.cls}`}>
                            {state.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            invited {grant.createdAt.toLocaleDateString()}
                            {grant.invitedByName ? ` by ${grant.invitedByName}` : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
