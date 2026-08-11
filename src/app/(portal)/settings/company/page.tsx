import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company profile · AI Partner" };

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");
  const company = await queryOne<{ name: string; website: string | null; industry: string | null }>(
    'SELECT "name", "website", "industry" FROM "Company" WHERE "id"=$1',
    [session.user.companyId],
  );
  return (
    <div className="page-container portal-page max-w-5xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <Building2 className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow">Settings</div>
            <h1 className="portal-page-title">Company profile</h1>
            <p className="portal-page-description">
              Permanent company information used to streamline every new brief.
            </p>
          </div>
        </div>
      </header>

      <section className="customer-panel p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold">{company?.name ?? "Your company"}</h2>
        <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Website</dt>
            <dd>{company?.website ?? "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Industry</dt>
            <dd>{company?.industry ?? "Not provided"}</dd>
          </div>
        </dl>
      </section>

      <section className="customer-panel p-5 sm:p-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-[14px] font-semibold">Workspace members</h2>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Manage Owners, Admins, Members, and pending invitations.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/settings/members">Manage members</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
