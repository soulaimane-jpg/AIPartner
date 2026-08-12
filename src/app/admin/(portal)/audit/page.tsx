import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { auth } from "@/lib/auth";
import { AuditLogTimeline } from "@/components/audit/audit-log-timeline";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";

interface SearchParams {
  kind?: string;
  actorId?: string;
  targetType?: string;
  limit?: string;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 100));

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" />
          Audit log
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Append-only record of every state-changing Server Action.
          Retention: 7 years. Filter by query string:{" "}
          <code className="font-mono text-xs">?kind=action.brief.</code>{" "}
          <code className="font-mono text-xs">?actorId=…</code>{" "}
          <code className="font-mono text-xs">?targetType=Match</code>.
        </p>
      </header>

      <AuditLogTimeline
        kindPrefix={params.kind || undefined}
        actorId={params.actorId || undefined}
        targetType={params.targetType || undefined}
        limit={limit}
      />
    </div>
  );
}
