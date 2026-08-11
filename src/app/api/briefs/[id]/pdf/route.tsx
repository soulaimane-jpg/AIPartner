import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { safeJsonParse } from "@/lib/utils";
import { SowPdfDocument, type SowPdfData } from "@/lib/pdf/sow-document";
import { STAGE_LABELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  // Allow the brief owner or an admin.
  const brief = await queryOne<ProjectBriefRow & { companyName: string | null }>(
    `SELECT b.*, c."name" AS "companyName"
     FROM "ProjectBrief" b
     LEFT JOIN "Company" c ON c."id" = b."companyId"
     WHERE b."id" = $1`,
    [id],
  );
  if (
    !brief ||
    (brief.ownerId !== session.user.id && session.user.role !== "ADMIN")
  ) {
    return new Response("Not found", { status: 404 });
  }

  // Pull structured arrays safely.
  const scopeRequirements = safeJsonParse<{ title: string; detail: string }[]>(
    brief.scopeRequirements,
    [],
  );
  const successCriteria = safeJsonParse<{ metric: string; target: string }[]>(
    brief.successCriteria,
    [],
  );
  const dataSources = safeJsonParse<{ name: string; detail: string }[]>(
    brief.dataSources,
    [],
  );
  const integrationPoints = safeJsonParse<
    { title: string; detail: string }[]
  >(brief.integrationPoints, []);
  // These columns have accumulated two shapes over time: plain strings and
  // objects. Accept both so older briefs still render.
  type MilestoneEntry = { title?: string; date?: string };
  type LabelledEntry = { name?: string; role?: string; title?: string };

  const milestonesRaw = safeJsonParse<Array<string | MilestoneEntry | null>>(
    brief.milestones ?? "[]",
    [],
  );
  const milestones = milestonesRaw.map((m) =>
    typeof m === "string"
      ? { title: m, date: "" }
      : { title: m?.title ?? "", date: m?.date ?? "" },
  );

  const normStrings = (json: string | null | undefined): string[] => {
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

  const data: SowPdfData = {
    title: brief.title || "Statement of Work",
    createdAt: brief.createdAt.toISOString(),
    completion: brief.completion,
    customerCompany: brief.companyName || "Customer",
    stage: STAGE_LABELS[brief.stage as keyof typeof STAGE_LABELS] || brief.stage,
    executiveSummary: brief.executiveSummary,
    scopeRequirements,
    successCriteria,
    dataSources,
    integrationPoints,
    customerRoles: normStrings(brief.customerRoles),
    milestones,
    targetGoLive: brief.targetGoLive,
    budgetRange: brief.budgetRange,
    preferredLocation: brief.preferredLocation,
    requiredCertifications: normStrings(brief.requiredCertifications),
    industryExperience: normStrings(brief.industryExperience),
    procurementType: brief.procurementType,
    decisionMakers: normStrings(brief.decisionMakers),
    selectionCriteria: normStrings(brief.selectionCriteria),
    services: normStrings(brief.services),
  };

  const buffer = await renderToBuffer(<SowPdfDocument data={data} />);
  // Convert Node Buffer → Uint8Array for Response body compatibility.
  const body = new Uint8Array(buffer);

  const safeSlug = (brief.title || "statement-of-work")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeSlug || "sow"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
