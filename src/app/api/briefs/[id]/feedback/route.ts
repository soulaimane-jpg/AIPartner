import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { anthropic, CLAUDE_MODEL, FEEDBACK_SYSTEM_PROMPT } from "@/lib/claude";
import { computeCompletionBreakdown } from "@/lib/brief";
import { safeJsonParse } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const brief = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [id, session.user.id],
  );
  if (!brief) {
    return new Response("Not found", { status: 404 });
  }

  // Build a compact, readable snapshot for Claude. We intentionally reuse
  // the same field shape the chat extracts into.
  const snapshot = {
    title: brief.title,
    executiveSummary: brief.executiveSummary,
    scopeRequirements: safeJsonParse(brief.scopeRequirements, []),
    dataSources: safeJsonParse(brief.dataSources, []),
    integrationPoints: safeJsonParse(brief.integrationPoints, []),
    successCriteria: safeJsonParse(brief.successCriteria, []),
    customerRoles: safeJsonParse(brief.customerRoles, []),
    targetGoLive: brief.targetGoLive,
    milestones: safeJsonParse(brief.milestones, []),
    budgetRange: brief.budgetRange,
    preferredLocation: brief.preferredLocation,
    requiredCertifications: safeJsonParse(brief.requiredCertifications, []),
    industryExperience: safeJsonParse(brief.industryExperience, []),
    procurementType: brief.procurementType,
    decisionMakers: safeJsonParse(brief.decisionMakers, []),
    selectionCriteria: safeJsonParse(brief.selectionCriteria, []),
    services: safeJsonParse(brief.services, []),
  };

  const breakdown = computeCompletionBreakdown(brief);

  try {
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      system: FEEDBACK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the customer's current SoW snapshot (JSON) and the raw completion breakdown.

Raw completion (${breakdown.total}%):
${JSON.stringify(breakdown.sections, null, 2)}

Brief snapshot:
${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    });

    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    const data = JSON.parse(cleaned);
    return Response.json({
      ok: true,
      data,
      completion: breakdown.total,
      breakdown: breakdown.sections,
    });
  } catch (e) {
    console.error(
      "Feedback generation failed:",
      e instanceof Error ? e.message : e,
    );
    return Response.json(
      { error: "Could not generate feedback right now." },
      { status: 500 },
    );
  }
}
