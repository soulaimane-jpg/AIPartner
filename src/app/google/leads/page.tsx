import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
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
    <div className="space-y-6 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every customer you&apos;ve referred — with live progress.
          </p>
        </div>
        <Button asChild className="h-10 px-5">
          <Link href="/google/leads/new">
            <UserPlus className="h-4 w-4 mr-2" /> Refer a customer
          </Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        {leads.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground italic">
            You haven&apos;t referred anyone yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-secondary/40 border-b border-border">
              <tr className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                <th className="px-6 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Invited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/google/leads/${l.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {l.companyName ?? l.customerDomain}
                    </Link>
                    {l.claimedUser?.name && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {l.claimedUser.name}
                        {l.claimedUser.company
                          ? ` · ${l.claimedUser.company.name}`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {l.customerEmail}
                  </td>
                  <td className="px-4 py-4">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground text-right">
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
