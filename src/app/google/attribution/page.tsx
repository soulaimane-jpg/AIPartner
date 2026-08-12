import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getGooglerAttribution } from "@/lib/googler-attribution";
import { LEAD_STATE_LABELS } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { requireGoogler } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Referral impact · Google Portal" };

export default async function GooglerAttributionPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireGoogler();

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
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <TrendingUp className="h-[18px] w-[18px]" />
          </span>
          <div>
            <Link
              href="/google/leads"
              className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Your leads
            </Link>
            <h1 className="portal-page-title">Referral impact</h1>
            <p className="portal-page-description">
              What happened to the customers you sent to AI Partner.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="customer-panel px-4 py-3.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {k.label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="customer-table overflow-x-auto">
        {referrals.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm italic text-muted-foreground">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            Refer a customer and their progress will show up here.
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-line bg-surface-sunk">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-5 py-3 sm:px-6">Customer</th>
                <th className="px-4 py-3">Briefs</th>
                <th className="px-4 py-3">Furthest stage</th>
                <th className="px-4 py-3">Engagements</th>
                <th className="px-4 py-3 text-right">Referred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {referrals.map((r) => (
                <tr
                  key={r.leadId}
                  className="transition-colors hover:bg-primary/5"
                >
                  <td className="px-5 py-3.5 sm:px-6">
                    <Link
                      href={`/google/leads/${r.leadId}`}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {r.companyName ?? r.customerDomain}
                    </Link>
                    {!r.claimedAt && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Invite not yet claimed
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {r.briefCount}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {r.furthestStage
                      ? (LEAD_STATE_LABELS[r.furthestStage] ?? r.furthestStage)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {r.engagementsAccepted > 0
                      ? `${r.engagementsAccepted} · ${formatCurrency(r.influencedValueCents)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
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
