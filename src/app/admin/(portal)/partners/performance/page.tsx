import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { auth } from "@/lib/auth";
import { listPartnerOps } from "@/lib/partner-ops";
import { PartnerOpsTable } from "@/components/admin/partner-ops-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner ops · Admin · AI Partner" };

/**
 * Admin partner-ops dashboard. Surfaces:
 *   - Volume (matches in last 90d)
 *   - Median response time
 *   - Accept / win rates
 *   - CSAT (avg NPS, ≥3 responses)
 *
 * Used to decide tier upgrades, partner re-engagement, and which
 * partners deserve more inbound briefs.
 */
export default async function PartnerOpsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  const rows = await listPartnerOps({ sinceDays: 90 });

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Partner operations
        </h1>
        <p className="text-sm text-muted-foreground">
          How partners are responding, accepting, winning, and being rated —
          trailing 90 days.
        </p>
      </header>

      <PartnerOpsTable rows={rows} />
    </div>
  );
}
