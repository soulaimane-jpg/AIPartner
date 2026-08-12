import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type {
  ProjectBriefRow,
  CustomerProfileRow,
  BriefSectionRow,
} from "@/lib/db/rows";
import { Badge } from "@/components/ui/badge";
import {
  BRIEF_SECTIONS,
  BRIEF_SECTION_KEYS,
  legacyBriefToSections,
} from "@/lib/sections";
import { getLeadState } from "@/lib/state-machine/lead";
import { loadThreadsForAudience } from "@/lib/serializers/threads";
import { ClarificationThreadView } from "@/components/clarifications/thread-view";
import { TriageActions } from "./triage-actions";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brief triage · AI Partner" };

/**
 * M4 — lead triage (plan-A refit). Checklist over the canonical
 * sections, company profile + onboarding answers side-by-side,
 * clarification loop, and the approve / clarify decision driven by
 * the lead state machine.
 */
export default async function AdminBriefTriagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }

  const brief = await queryOne<
    ProjectBriefRow & {
      ownerName: string | null;
      ownerEmail: string | null;
      companyName: string;
    }
  >(
    `SELECT b.*, u."name" AS "ownerName", u."email" AS "ownerEmail",
            c."name" AS "companyName"
     FROM "ProjectBrief" b
     LEFT JOIN "User" u ON u."id" = b."ownerId"
     JOIN "Company" c ON c."id" = b."companyId"
     WHERE b."id" = $1`,
    [id],
  );
  if (!brief) notFound();

  const profile = await queryOne<CustomerProfileRow>(
    'SELECT * FROM "CustomerProfile" WHERE "companyId" = $1',
    [brief.companyId],
  );
  const briefSections = await query<BriefSectionRow>(
    'SELECT * FROM "BriefSection" WHERE "briefId" = $1 ORDER BY "rank" ASC',
    [id],
  );

  const leadState = (await getLeadState(brief.id)) ?? "DRAFT";

  // Canonical sections with legacy-column fallback (pre-plan-A briefs).
  const legacy = legacyBriefToSections(brief);
  const byKey = new Map(briefSections.map((s) => [s.key, s]));
  const sections = BRIEF_SECTION_KEYS.map((key) => {
    const meta = BRIEF_SECTIONS[key];
    const row = byKey.get(key);
    const content = row?.content?.trim() || legacy[key] || "";
    return {
      key,
      label: meta.label,
      mandatory: meta.mandatory,
      content,
      aiGenerated: row?.aiGenerated ?? false,
    };
  });
  const missingMandatory = sections.filter((s) => s.mandatory && !s.content);

  let questionState: Record<string, { state: string }> = {};
  try {
    questionState = JSON.parse(
      profile?.onboardingQuestionsState ?? "{}",
    ) as typeof questionState;
  } catch {
    questionState = {};
  }
  const skippedQuestions = Object.entries(questionState)
    .filter(([, v]) => v.state === "skipped")
    .map(([k]) => k);

  const threads = await loadThreadsForAudience({
    briefId: brief.id,
    audience: "admin",
    viewerUserId: session.user.id,
    contextTypes: ["brief_triage"],
  });

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <Link
          href="/admin/briefs"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All briefs
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="portal-page-title">
            Triage — {brief.title}
          </h1>
          <Badge variant="outline" className="font-mono text-[10.5px] uppercase tracking-wider">
            {leadState}
          </Badge>
          <Badge variant="outline" className="text-[10.5px] uppercase tracking-wider">
            origin: {brief.origin}
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {brief.companyName} · {brief.ownerName ?? brief.ownerEmail}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: sections + decision + threads ── */}
        <div className="space-y-6 min-w-0">
          <section className="customer-panel overflow-hidden">
            <header className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-foreground">
                Brief sections
              </h2>
              <span
                className={
                  missingMandatory.length === 0
                    ? "text-[12px] text-emerald-700"
                    : "text-[12px] text-amber-700"
                }
              >
                {missingMandatory.length === 0
                  ? "All mandatory sections present"
                  : `${missingMandatory.length} mandatory missing`}
              </span>
            </header>
            <div className="divide-y divide-border">
              {sections.map((s) => (
                <div key={s.key} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {s.content ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle
                        className={
                          s.mandatory
                            ? "h-3.5 w-3.5 text-amber-600 shrink-0"
                            : "h-3.5 w-3.5 text-muted-foreground/50 shrink-0"
                        }
                      />
                    )}
                    <span className="text-[13px] font-medium text-foreground">
                      {s.label}
                    </span>
                    {s.mandatory && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        required
                      </span>
                    )}
                    {s.aiGenerated && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider ml-auto">
                        AI — unconfirmed
                      </Badge>
                    )}
                  </div>
                  {s.content && (
                    <p className="mt-1.5 text-[12.5px] text-foreground/75 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {s.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <TriageActions
            briefId={brief.id}
            leadState={leadState}
            suggestedSummary={brief.anonymizedCompanySummary ?? ""}
          />

          <section className="space-y-3">
            <h2 className="text-[14px] font-semibold text-foreground">
              Clarification threads
            </h2>
            {threads.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No triage clarifications yet.
              </p>
            ) : (
              threads.map((thread) => (
                <ClarificationThreadView
                  key={thread.id}
                  thread={thread}
                  briefId={brief.id}
                  canResolve
                />
              ))
            )}
          </section>
        </div>

        {/* ── Right: company profile + onboarding answers ── */}
        <aside className="space-y-4">
          <section className="customer-panel space-y-3 p-4">
            <h2 className="text-[13px] font-semibold text-foreground">
              Company profile
            </h2>
            <dl className="space-y-2.5 text-[12.5px]">
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="text-foreground font-medium">
                  {brief.companyName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Employees</dt>
                <dd className="text-foreground">
                  {profile?.employeeCountBand ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">GCP agreement</dt>
                <dd className="text-foreground">
                  {profile?.gcpAgreementStatus ?? "not answered"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contract ends</dt>
                <dd className="text-foreground">
                  {profile?.gcpContractEndDate
                    ? profile.gcpContractEndDate.toISOString().slice(0, 10)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Discount % (admin-only)
                </dt>
                <dd className="text-foreground">
                  {profile?.gcpDiscountPct != null
                    ? `${profile.gcpDiscountPct}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Resell interest</dt>
                <dd className="text-foreground">
                  {profile?.resellInterest ?? "not answered"}
                </dd>
              </div>
            </dl>
            {skippedQuestions.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
                Skipped onboarding questions:{" "}
                {skippedQuestions.join(", ")} — worth asking during
                clarification.
              </div>
            )}
          </section>

          {brief.callTranscript && (
            <section className="customer-panel p-4">
              <h2 className="text-[13px] font-semibold text-foreground">
                Call intake
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                This brief was generated from a scoping call.
              </p>
              <Link
                href={`/admin/briefs/${brief.id}/transcript`}
                className="mt-2 inline-block text-[12.5px] text-foreground underline underline-offset-2"
              >
                View / re-run transcript extraction
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
