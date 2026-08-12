import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { query, queryOne, count } from "@/lib/db";
import type {
  CompanyRow,
  PartnerProfileRow,
  PartnerContactRow,
} from "@/lib/db/rows";
import { Badge } from "@/components/ui/badge";
import { safeJsonParse, timeAgo } from "@/lib/utils";
import { PartnerContactsManager } from "./partner-contacts-manager";
import { TncStatusControl } from "./tnc-status-control";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner detail · Admin" };

/**
 * M5 — admin partner detail: profile summary, source + T&C tracking,
 * and contact-person management (primary = lead-routing recipient).
 */
export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await queryOne<CompanyRow>(
    `SELECT * FROM "Company" WHERE "id" = $1 AND "kind" = 'PARTNER'`,
    [id],
  );
  if (!partner) notFound();

  const profile = await queryOne<PartnerProfileRow>(
    'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
    [partner.id],
  );
  const contacts = profile
    ? await query<PartnerContactRow>(
        'SELECT * FROM "PartnerContact" WHERE "profileId" = $1 ORDER BY "isPrimary" DESC',
        [profile.id],
      )
    : [];
  const [usersCount, matchesCount, proposalsCount] = await Promise.all([
    count('SELECT COUNT(*) FROM "User" WHERE "companyId" = $1', [partner.id]),
    count('SELECT COUNT(*) FROM "Match" WHERE "partnerId" = $1', [partner.id]),
    count('SELECT COUNT(*) FROM "Proposal" WHERE "partnerId" = $1', [partner.id]),
  ]);
  const specs = safeJsonParse<string[]>(profile?.specializations ?? "[]", []);
  const clouds = safeJsonParse<string[]>(profile?.clouds ?? '["gcp"]', ["gcp"]);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All partners
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="portal-page-title">
            {partner.name}
          </h1>
          <Badge variant="outline" className="uppercase text-[10.5px] tracking-wider">
            {profile?.tier ?? "MEMBER"}
          </Badge>
          <Badge variant="outline" className="text-[10.5px] uppercase tracking-wider">
            source: {profile?.source ?? "imported"}
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {profile?.tagline ?? "—"} · joined {timeAgo(partner.createdAt)} ·{" "}
          {matchesCount} matches · {proposalsCount} proposals
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="customer-panel space-y-4 p-5">
          <h2 className="text-[14px] font-semibold text-foreground">Profile</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="text-foreground truncate">
                {profile?.website ?? partner.website ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Headquarters</dt>
              <dd className="text-foreground">{profile?.headquarters ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Size band</dt>
              <dd className="text-foreground">
                {profile?.sizeBand ?? profile?.teamSize ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Clouds</dt>
              <dd className="text-foreground uppercase">{clouds.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Portal users</dt>
              <dd className="text-foreground">{usersCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">GCP tier</dt>
              <dd className="text-foreground">{profile?.gcpTier ?? "—"}</dd>
            </div>
          </dl>
          {specs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
              {specs.slice(0, 12).map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-[10.5px] font-mono"
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </section>

        <section className="customer-panel space-y-4 p-5">
          <h2 className="text-[14px] font-semibold text-foreground">
            Terms &amp; Conditions
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            {profile?.acceptedTermsAt
              ? `Accepted ${timeAgo(profile.acceptedTermsAt)} by ${profile.acceptedTermsName ?? "—"}${profile.tncVersion ? ` (v${profile.tncVersion})` : ""}.`
              : "No acceptance recorded yet — partners accept at the legal gate on first login."}
          </p>
          <TncStatusControl
            companyId={partner.id}
            current={profile?.tncStatus ?? "not_sent"}
          />
        </section>
      </div>

      <PartnerContactsManager
        companyId={partner.id}
        contacts={contacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          email: c.email,
          isPrimary: c.isPrimary,
        }))}
      />
    </div>
  );
}
