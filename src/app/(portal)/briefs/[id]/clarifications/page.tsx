import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { loadThreadsForAudience } from "@/lib/serializers/threads";
import { ClarificationThreadView } from "@/components/clarifications/thread-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clarifications · AI Partner" };

/**
 * M9 — customer clarifications inbox for one brief. Shows triage
 * questions from the AIPartner team and anonymized partner questions
 * ("Partner A asked…"). Reply by message or propose a call.
 */
export default async function BriefClarificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const brief = await queryOne<{ id: string; title: string }>(
    'SELECT "id", "title" FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [id, session.user.id],
  );
  if (!brief) notFound();

  const threads = await loadThreadsForAudience({
    briefId: brief.id,
    audience: "company",
    viewerUserId: session.user.id,
  });

  return (
    <div className="page-container pt-8 pb-20">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">
            Clarifications
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Questions on &quot;{brief.title}&quot; from our team and matched
            partners. Partner identities stay anonymized until you select and
            reveal.
          </p>
        </header>

        {threads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-elev-1">
            <p className="text-[13.5px] text-muted-foreground">
              No open questions right now — we&apos;ll notify you when
              something needs your input.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <ClarificationThreadView
                key={thread.id}
                thread={thread}
                briefId={brief.id}
                canResolve={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
