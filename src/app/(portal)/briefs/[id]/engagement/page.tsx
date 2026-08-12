import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileSignature } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isPartnerRevealed } from "@/lib/serializers/firewall";
import { EngagementView, type EngagementDTO } from "./engagement-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Engagement · AI Partner" };

export default async function BriefEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const engagement = await queryOne<{
    id: string;
    briefId: string;
    status: string;
    acceptedScope: string | null;
    contractValueCents: string | null;
    currency: string;
    startDate: Date | null;
    durationMonths: number | null;
    acceptedAt: Date | null;
    acceptedByName: string | null;
    deliveredAt: Date | null;
    briefTitle: string;
    companyId: string;
    leadState: string;
    matchStatus: string;
    partnerName: string;
  }>(
    `SELECT e."id", e."briefId", e."status", e."acceptedScope",
            e."contractValueCents"::text AS "contractValueCents", e."currency",
            e."startDate", e."durationMonths", e."acceptedAt", e."acceptedByName",
            e."deliveredAt",
            b."title" AS "briefTitle", b."companyId", b."leadState",
            m."status" AS "matchStatus",
            c."name" AS "partnerName"
       FROM "Engagement" e
       JOIN "ProjectBrief" b ON b."id" = e."briefId"
       JOIN "Match" m ON m."id" = e."matchId"
       JOIN "Company" c ON c."id" = e."partnerId"
      WHERE e."briefId" = $1`,
    [id],
  );

  if (!engagement) {
    return (
      <div className="page-container-wide pt-10 pb-20 text-center space-y-4">
        <FileSignature className="mx-auto h-9 w-9 text-muted-foreground" />
        <h1 className="text-[22px] font-semibold tracking-tight">
          No engagement yet
        </h1>
        <p className="text-[13.5px] text-muted-foreground max-w-md mx-auto">
          Once you&apos;ve met your selected partner and agreed the scope, the
          engagement will appear here for you to confirm.
        </p>
        <Link
          href={`/briefs/${id}/preview`}
          className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to brief
        </Link>
      </div>
    );
  }

  // Tenant check: workspace members of the owning company only.
  if (engagement.companyId !== session.user.companyId) notFound();

  // By this point the partner has been selected and revealed, but the
  // gate is still evaluated rather than assumed (§8).
  const revealed = isPartnerRevealed({
    leadState: engagement.leadState,
    matchStatus: engagement.matchStatus,
  });

  const milestones = await query<{
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: string;
  }>(
    `SELECT "id", "title", "description", "dueDate", "status"
       FROM "EngagementMilestone"
      WHERE "engagementId" = $1
      ORDER BY "rank" ASC, "createdAt" ASC`,
    [engagement.id],
  );

  const dto: EngagementDTO = {
    id: engagement.id,
    briefId: engagement.briefId,
    briefTitle: engagement.briefTitle,
    status: engagement.status,
    partnerLabel: revealed ? engagement.partnerName : "Your selected partner",
    acceptedScope: engagement.acceptedScope,
    contractValueCents: engagement.contractValueCents
      ? Number(engagement.contractValueCents)
      : null,
    currency: engagement.currency,
    startDate: engagement.startDate?.toISOString() ?? null,
    durationMonths: engagement.durationMonths,
    acceptedAt: engagement.acceptedAt?.toISOString() ?? null,
    acceptedByName: engagement.acceptedByName,
    deliveredAt: engagement.deliveredAt?.toISOString() ?? null,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      dueDate: m.dueDate?.toISOString() ?? null,
      status: m.status,
    })),
  };

  return (
    <div className="page-container-wide pt-8 pb-20">
      <Link
        href={`/briefs/${id}/preview`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to brief
      </Link>
      <EngagementView engagement={dto} />
    </div>
  );
}
