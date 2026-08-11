import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { safeJsonParse } from "@/lib/utils";
import { BriefEditor, type EditorState } from "@/components/brief-editor";
import { BriefWorkspaceHeader } from "@/components/brief-workspace-header";
import type { BriefStage, BriefStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit brief · AI Partner" };

export default async function BriefEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const brief = await queryOne<
    ProjectBriefRow & { proposalsCount: number; sourcedCount: number }
  >(
    `SELECT b.*,
       (SELECT COUNT(*) FROM "Proposal" p WHERE p."briefId" = b."id")::int AS "proposalsCount",
       (SELECT COUNT(*) FROM "Match" m WHERE m."briefId" = b."id" AND m."status" = 'SOURCED')::int AS "sourcedCount"
     FROM "ProjectBrief" b
     WHERE b."id" = $1 AND b."ownerId" = $2`,
    [id, session.user.id],
  );
  if (!brief) notFound();

  // These columns have accumulated two shapes over time: plain strings and
  // objects keyed by name/role/title. Accept both and flatten to strings.
  type LabelledEntry = { name?: string; role?: string; title?: string };
  const normStringArray = (json: string | null | undefined): string[] => {
    const arr = safeJsonParse<Array<string | LabelledEntry | null>>(
      json ?? "[]",
      [],
    );
    return arr
      .map((x) =>
        typeof x === "string" ? x : (x?.name || x?.role || x?.title || ""),
      )
      .filter(Boolean);
  };

  const initial: EditorState = {
    title: brief.title || "",
    executiveSummary: brief.executiveSummary ?? "",
    targetGoLive: brief.targetGoLive ?? "",
    budgetRange: brief.budgetRange ?? "",
    preferredLocation: brief.preferredLocation ?? "",
    procurementType: brief.procurementType ?? "",
    scopeRequirements: safeJsonParse(brief.scopeRequirements, []),
    successCriteria: safeJsonParse(brief.successCriteria, []),
    dataSources: safeJsonParse(brief.dataSources, []),
    integrationPoints: safeJsonParse(brief.integrationPoints, []),
    customerRoles: normStringArray(brief.customerRoles),
    milestones: safeJsonParse(brief.milestones, []),
    requiredCertifications: normStringArray(brief.requiredCertifications),
    industryExperience: normStringArray(brief.industryExperience),
    decisionMakers: normStringArray(brief.decisionMakers),
    selectionCriteria: normStringArray(brief.selectionCriteria),
    services: normStringArray(brief.services),
  };

  return (
    <div className="page-container-wide pt-6 pb-20">
      <BriefWorkspaceHeader
        briefId={brief.id}
        title={brief.title}
        stage={brief.stage as BriefStage}
        status={brief.status as BriefStatus}
        completion={brief.completion}
        proposalsCount={brief.proposalsCount}
        hasMatches={brief.sourcedCount > 0}
      />

      <div className="mt-6">
        <BriefEditor briefId={brief.id} initial={initial} />
      </div>
    </div>
  );
}
