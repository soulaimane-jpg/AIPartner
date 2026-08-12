import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getGooglerLeads } from "@/lib/lead-query";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your leads · Google Portal" };

export default async function GooglerLeadsListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/google/leads");

  const leads = await getGooglerLeads(session.user.id);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <UserPlus className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h1 className="portal-page-title">Your leads</h1>
            <p className="portal-page-description">
              Every customer you&apos;ve referred — with live progress.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/google/attribution">
              <TrendingUp className="h-4 w-4" /> Referral impact
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/google/leads/new">
              <UserPlus className="h-4 w-4" /> Refer a customer
            </Link>
          </Button>
        </div>
      </header>

      <div className="customer-table overflow-x-auto">
        {leads.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm italic text-muted-foreground">
            You haven&apos;t referred anyone yet.
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface-sunk">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-5 py-3 sm:px-6">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Invited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-primary/5">
                  <td className="px-5 py-3.5 sm:px-6">
                    <Link
                      href={`/google/leads/${l.id}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {l.companyName ?? l.customerDomain}
                    </Link>
                    {l.claimedUser?.name && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {l.claimedUser.name}
                        {l.claimedUser.company
                          ? ` · ${l.claimedUser.company.name}`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {l.customerEmail}
                  </td>
                  <td className="px-4 py-3.5">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                    {timeAgo(l.invitedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
