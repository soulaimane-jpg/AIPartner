import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getGooglerAttribution } from "@/lib/googler-attribution";
import { LEAD_STATE_LABELS } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referral impact · Google Portal" };

export default async function GooglerAttributionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/google/attribution");

  const { summary, referrals } = await getGooglerAttribution(session.user.id);

  const kpis = [
    { label: "Referred", value: String(summary.invited) },
    { label: "Signed up", value: String(summary.claimed) },
    { label: "Briefs submitted", value: String(summary.briefsSubmitted) },
    { label: "Meetings", value: String(summary.meetingsScheduled) },
    { label: "Engagements", value: String(summary.engagementsAccepted) },
    {
      label: "Influenced value",
      value:
        summary.influencedValueCents > 0
          ? formatCurrency(summary.influencedValueCents)
          : "—",
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div>
        <Link
          href="/google/leads"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Your leads
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Referral impact</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What happened to the customers you sent to AI Partner.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-border bg-white px-4 py-3"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        {referrals.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground italic">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            Refer a customer and their progress will show up here.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-secondary/40 border-b border-border">
              <tr className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                <th className="px-6 py-3">Customer</th>
                <th className="px-4 py-3">Briefs</th>
                <th className="px-4 py-3">Furthest stage</th>
                <th className="px-4 py-3">Engagements</th>
                <th className="px-4 py-3 text-right">Referred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {referrals.map((r) => (
                <tr
                  key={r.leadId}
                  className="hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/google/leads/${r.leadId}`}
                      className="text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {r.companyName ?? r.customerDomain}
                    </Link>
                    {!r.claimedAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Invite not yet claimed
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {r.briefCount}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {r.furthestStage
                      ? (LEAD_STATE_LABELS[r.furthestStage] ?? r.furthestStage)
                      : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {r.engagementsAccepted > 0
                      ? `${r.engagementsAccepted} · ${formatCurrency(r.influencedValueCents)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground text-right">
                    {timeAgo(r.invitedAt)}
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
