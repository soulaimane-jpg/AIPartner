import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import {
  getPartnerPipelinePhase,
  getPartnerWorkspaceBucket,
  isPartnerActionRequired,
  type PartnerPipelinePhase,
} from "@/lib/partner-workflow";

export type PartnerPortalCompany = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  website: string | null;
  headquarters: string | null;
  teamSize: string | null;
  industry: string | null;
  tier: string | null;
  gcpTier: string | null;
  leadRoutingEmail: string | null;
  specializations: string[];
  expertiseAreas: string[];
  regions: string[];
  profileCompletion: number;
};

export type PartnerPortalItem = {
  id: string;
  matchStatus: string;
  matchScore: number | null;
  acceptDeadlineAt: Date | null;
  proposalDeadlineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  briefId: string;
  briefTitle: string;
  briefStage: string;
  briefServices: string[];
  anonymizedCompanySummary: string | null;
  executiveSummary: string | null;
  budgetRange: string | null;
  preferredLocation: string | null;
  targetGoLive: string | null;
  proposalStatus: string | null;
  proposalTotalCost: number | null;
  proposalTimelineWeeks: number | null;
  proposalSubmittedAt: Date | null;
};

export type PartnerWorkspaceData = {
  user: { id: string; name: string; email: string };
  company: PartnerPortalCompany;
  items: PartnerPortalItem[];
  opportunities: PartnerPortalItem[];
  pipeline: PartnerPortalItem[];
  pipelineByPhase: Record<PartnerPipelinePhase, PartnerPortalItem[]>;
  won: PartnerPortalItem[];
  closed: PartnerPortalItem[];
  actionRequired: PartnerPortalItem[];
};

type PartnerCompanyRow = Omit<PartnerPortalCompany, "specializations" | "expertiseAreas" | "regions" | "profileCompletion"> & {
  specializations: string | null;
  expertiseAreas: string | null;
  regions: string | null;
};

type PartnerItemRow = Omit<PartnerPortalItem, "briefServices" | "matchStatus"> & {
  status: string;
  briefServices: string;
};

export async function getPartnerWorkspaceData(): Promise<PartnerWorkspaceData> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/partner/login");

  const companyRow = await queryOne<PartnerCompanyRow>(
    `SELECT c."id", c."name", pp."tagline", pp."description", pp."website",
            pp."headquarters", pp."teamSize", pp."industry", pp."tier", pp."gcpTier",
            pp."leadRoutingEmail", pp."specializations", pp."expertiseAreas", pp."regions"
     FROM "Company" c
     LEFT JOIN "PartnerProfile" pp ON pp."companyId" = c."id"
     WHERE c."id" = $1`,
    [session.user.companyId],
  );
  if (!companyRow) redirect("/partner/login");

  const rows = await query<PartnerItemRow>(
    `SELECT m."id", m."status", m."matchScore", m."acceptDeadlineAt",
            m."proposalDeadlineAt", m."createdAt", m."updatedAt",
            b."id" AS "briefId", b."title" AS "briefTitle", b."stage" AS "briefStage",
            b."services" AS "briefServices", b."anonymizedCompanySummary",
            b."executiveSummary", b."budgetRange", b."preferredLocation", b."targetGoLive",
            p."status" AS "proposalStatus", p."totalCost" AS "proposalTotalCost",
            p."timelineWeeks" AS "proposalTimelineWeeks", p."submittedAt" AS "proposalSubmittedAt"
     FROM "Match" m
     JOIN "ProjectBrief" b ON b."id" = m."briefId"
     LEFT JOIN "Proposal" p ON p."matchId" = m."id"
     WHERE m."partnerId" = $1
     ORDER BY m."updatedAt" DESC`,
    [companyRow.id],
  );

  const company = normalizeCompany(companyRow);
  const items = rows.map(normalizeItem);
  const opportunities: PartnerPortalItem[] = [];
  const pipeline: PartnerPortalItem[] = [];
  const won: PartnerPortalItem[] = [];
  const closed: PartnerPortalItem[] = [];
  const pipelineByPhase: Record<PartnerPipelinePhase, PartnerPortalItem[]> = {
    proposal: [],
    review: [],
    finalist: [],
  };

  for (const item of items) {
    const bucket = getPartnerWorkspaceBucket(item.matchStatus, item.proposalStatus);
    if (bucket === "opportunities") opportunities.push(item);
    if (bucket === "pipeline") {
      pipeline.push(item);
      pipelineByPhase[getPartnerPipelinePhase(item.matchStatus, item.proposalStatus)].push(item);
    }
    if (bucket === "won") won.push(item);
    if (bucket === "closed") closed.push(item);
  }

  const actionRequired = items.filter((item) =>
    isPartnerActionRequired(item.matchStatus, item.proposalStatus),
  );

  return {
    user: {
      id: session.user.id,
      name: session.user.name ?? "",
      email: session.user.email ?? "",
    },
    company,
    items,
    opportunities,
    pipeline,
    pipelineByPhase,
    won,
    closed,
    actionRequired,
  };
}

function normalizeCompany(row: PartnerCompanyRow): PartnerPortalCompany {
  const specializations = safeJsonParse<string[]>(row.specializations ?? "[]", []);
  const expertiseAreas = safeJsonParse<string[]>(row.expertiseAreas ?? "[]", []);
  const regions = safeJsonParse<string[]>(row.regions ?? "[]", []);
  const required = [
    row.name,
    row.tagline,
    row.description,
    row.website,
    row.headquarters,
    row.teamSize,
    row.industry,
    row.gcpTier || row.tier,
    row.leadRoutingEmail,
    specializations.length > 0,
    expertiseAreas.length > 0,
    regions.length > 0,
  ];
  const completed = required.filter(Boolean).length;

  return {
    ...row,
    specializations,
    expertiseAreas,
    regions,
    profileCompletion: Math.round((completed / required.length) * 100),
  };
}

function normalizeItem(row: PartnerItemRow): PartnerPortalItem {
  return {
    ...row,
    matchStatus: row.status,
    briefServices: safeJsonParse<string[]>(row.briefServices, []),
  };
}
