import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { ProjectRouter } from "@/components/project-router";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const metadata = { title: "New brief · AI Partner" };

export default async function NewBriefPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");
  const context = await queryOne<{ ready: boolean }>(
    `SELECT ("completedAt" IS NOT NULL OR "skippedAt" IS NOT NULL) AS ready
     FROM "CompanyCloudContext" WHERE "companyId" = $1`,
    [session.user.companyId],
  );
  if (!context?.ready) redirect("/briefs/new/cloud-context");
  const preferences = await queryOne<{ challengeAreas: string }>(
    'SELECT "challengeAreas" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );
  let defaults: string[] = [];
  try { defaults = JSON.parse(preferences?.challengeAreas ?? "[]"); } catch { defaults = []; }

  return (
    <div className="page-container portal-page max-w-3xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden>
            <ClipboardList className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">Project setup</div>
            <h1 className="portal-page-title">Start a new brief</h1>
            <p className="portal-page-description">
              Set the project context and required expertise, then continue into guided AI scoping.
            </p>
          </div>
        </div>
      </header>

      <ProjectRouter defaults={defaults} />
    </div>
  );
}

