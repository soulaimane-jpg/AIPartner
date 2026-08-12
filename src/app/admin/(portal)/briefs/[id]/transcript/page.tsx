import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { TranscriptForm } from "./transcript-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Call transcript · Admin" };

/**
 * M3.3 — admin attaches the scoping-call transcript; Claude extracts
 * the structured brief sections and the customer is notified to
 * review. Re-running replaces AI-generated sections (human-edited
 * ones are only overwritten by the customer).
 */
export default async function AdminTranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = await queryOne<{
    id: string;
    title: string;
    origin: string;
    callTranscript: string | null;
    callRecordingRef: string | null;
    ownerName: string | null;
    ownerEmail: string;
    companyName: string;
  }>(
    `SELECT b."id", b."title", b."origin", b."callTranscript", b."callRecordingRef",
            u."name" AS "ownerName", u."email" AS "ownerEmail", c."name" AS "companyName"
     FROM "ProjectBrief" b
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     JOIN "Company" c ON c."id" = b."companyId"
     WHERE b."id" = $1`,
    [id],
  );
  if (!brief) notFound();

  const briefSections = await query<{
    key: string;
    aiGenerated: boolean;
    updatedAt: Date;
  }>(
    'SELECT "key", "aiGenerated", "updatedAt" FROM "BriefSection" WHERE "briefId" = $1 ORDER BY "rank" ASC',
    [id],
  );

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <Link
          href={`/admin/briefs/${brief.id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Brief
        </Link>
        <h1 className="portal-page-title mt-2">
          Call transcript — {brief.title}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {brief.companyName} · requested by {brief.ownerName ?? brief.ownerEmail} ·
          origin: {brief.origin}
        </p>
      </header>

      {briefSections.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-[13px] text-foreground">
          {briefSections.length} section
          {briefSections.length === 1 ? "" : "s"} already generated —{" "}
          {briefSections.filter((s) => s.aiGenerated).length} still
          AI-flagged (awaiting customer review). Re-running extraction
          overwrites them.
        </div>
      )}

      <TranscriptForm
        briefId={brief.id}
        existingTranscript={brief.callTranscript ?? ""}
        existingRecordingRef={brief.callRecordingRef ?? ""}
      />
    </div>
  );
}
