import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { ProjectBriefRow, ChatMessageRow } from "@/lib/db/rows";
import { BriefBuilderClient } from "@/components/brief-builder-client";
import { BriefWorkspaceHeader } from "@/components/brief-workspace-header";
import { computeCompletionBreakdown } from "@/lib/brief";
import type { BriefStage, BriefStatus } from "@/lib/enums";
import { getBriefCapabilities } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Builder · AI Partner" };

export default async function BriefBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const capabilities = await getBriefCapabilities(
    {
      userId: session.user.id,
      companyId: session.user.companyId,
      platformRole: session.user.role,
    },
    id,
  );
  if (!capabilities.canEditBrief) notFound();

  // The customer's own chat turns should carry their face, not a generic
  // glyph. Read from the User row rather than the session so a freshly
  // uploaded picture appears without re-logging in. Avatars stored in GCS
  // are served through the signed-URL route, the same swap PortalShell does.
  const me = await queryOne<{ name: string | null; email: string; image: string | null }>(
    'SELECT "name", "email", "image" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  const viewer = {
    name: me?.name || me?.email || session.user.email || "You",
    image: me?.image?.startsWith("gcs:")
      ? "/api/account/avatar"
      : (me?.image ?? null),
  };

  const brief = await queryOne<
    ProjectBriefRow & { proposalsCount: number; sourcedCount: number }
  >(
    `SELECT b.*,
       (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id")::int AS "proposalsCount",
       (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id" AND m."status" = 'SOURCED')::int AS "sourcedCount"
     FROM "ProjectBrief" b
     WHERE b."id" = $1`,
    [id],
  );
  if (!brief) notFound();
  const messages = await query<ChatMessageRow>(
    'SELECT * FROM "ChatMessage" WHERE "briefId" = $1 ORDER BY "createdAt" ASC',
    [id],
  );

  return (
    <div className="page-container-wide flex min-h-[calc(100vh-3.5rem)] flex-col px-4 pb-8 sm:px-6 lg:px-8">
      <BriefWorkspaceHeader
        briefId={brief.id}
        title={brief.title}
        stage={brief.stage as BriefStage}
        status={brief.status as BriefStatus}
        completion={brief.completion}
        proposalsCount={brief.proposalsCount}
        hasMatches={brief.sourcedCount > 0}
      />

      <div className="min-h-0 flex-1 pt-6">
        <BriefBuilderClient
          briefId={brief.id}
          completion={brief.completion}
          sections={computeCompletionBreakdown(brief).sections}
          initialMessages={messages}
          previewHref={`/briefs/${id}/preview`}
          viewer={viewer}
        />
      </div>
    </div>
  );
}
