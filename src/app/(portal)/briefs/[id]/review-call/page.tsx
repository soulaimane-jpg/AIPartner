import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { BriefSectionRow } from "@/lib/db/rows";
import { BRIEF_SECTIONS, BRIEF_SECTION_KEYS } from "@/lib/sections";
import { ReviewCallBrief } from "./review-call-brief";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review your brief · AI Partner" };

/**
 * M3.3 — customer reviews the call-generated brief. Every section is
 * editable; AI-generated sections are flagged until a human touches
 * them. Confirming submits the brief into triage (leadState →
 * SUBMITTED). Nothing reaches partners without this confirmation.
 */
export default async function ReviewCallBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const brief = await queryOne<{
    id: string;
    title: string;
    leadState: string;
  }>(
    'SELECT "id", "title", "leadState" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [id, session.user.id],
  );
  if (!brief) notFound();

  const briefSections = await query<BriefSectionRow>(
    'SELECT * FROM "BriefSection" WHERE "briefId" = $1 ORDER BY "rank" ASC',
    [id],
  );
  const sectionsByKey = new Map(briefSections.map((s) => [s.key, s]));
  const sections = BRIEF_SECTION_KEYS.map((key) => {
    const meta = BRIEF_SECTIONS[key];
    const row = sectionsByKey.get(key);
    return {
      key,
      label: meta.label,
      hint: meta.hint,
      mandatory: meta.mandatory,
      content: row?.content ?? "",
      aiGenerated: row?.aiGenerated ?? false,
    };
  });

  const alreadySubmitted = brief.leadState !== "DRAFT";

  return (
    <div className="page-container pt-8 pb-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground">
          Review your project brief
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          We turned your call into the structured brief below. Please check
          every section — especially the AI-flagged ones — and edit anything
          we got wrong. Your project only enters partner matching after you
          confirm.
        </p>
        <div className="mt-8">
          <ReviewCallBrief
            briefId={brief.id}
            sections={sections}
            alreadySubmitted={alreadySubmitted}
          />
        </div>
      </div>
    </div>
  );
}
