import { redirect } from "next/navigation";
import { Building2, UserRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { CustomerProfileRow } from "@/lib/db/rows";
import { AccountProfileForm } from "@/components/account-profile-form";
import { CustomerProfileCard } from "@/components/customer-profile-card";
import { IconTile } from "@/components/ui/icon-tile";
import type {
  CustomerRawProfile,
  CustomerAnonymizedProfile,
} from "@/lib/customer-profile";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");
  if (session.user.role !== "CUSTOMER") redirect("/dashboard");
  if (!session.user.companyId) redirect("/dashboard");

  const [profile, account, company] = await Promise.all([
    queryOne<CustomerProfileRow>(
      'SELECT * FROM "CustomerProfile" WHERE "companyId" = $1',
      [session.user.companyId],
    ),
    queryOne<{
      name: string | null;
      email: string;
      jobTitle: string | null;
      location: string | null;
      image: string | null;
      emailVerified: Date | null;
      passwordHash: string | null;
      googleId: string | null;
    }>(
      `SELECT "name", "email", "jobTitle", "location", "image", "emailVerified", "passwordHash", "googleId"
       FROM "User" WHERE "id" = $1`,
      [session.user.id],
    ),
    queryOne<{ name: string }>('SELECT "name" FROM "Company" WHERE "id" = $1', [session.user.companyId]),
  ]);

  const safeParse = <T,>(json: string | null | undefined, fallback: T): T => {
    try {
      return json ? (JSON.parse(json) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const raw = safeParse<CustomerRawProfile | null>(
    profile?.rawProfile ?? null,
    null,
  );
  const anon = safeParse<CustomerAnonymizedProfile | null>(
    profile?.anonymizedProfile ?? null,
    null,
  );

  const imageUrl = account?.image?.startsWith("gcs:")
    ? "/api/account/avatar"
    : account?.image ?? null;

  return (
    <div className="page-container portal-page max-w-6xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <IconTile size="md" tone="indigo" aria-hidden>
            <UserRound />
          </IconTile>
          <div>
            <div className="eyebrow text-primary">Your account</div>
            <h1 className="portal-page-title">Profile & preferences</h1>
            <p className="portal-page-description">
              Manage your identity, sign-in options, and the organization profile shared during partner matching.
            </p>
          </div>
        </div>
      </header>

      <AccountProfileForm
        initial={{
          name: account?.name ?? session.user.name ?? "",
          email: account?.email ?? session.user.email ?? "",
          jobTitle: account?.jobTitle ?? "",
          location: account?.location ?? "",
          imageUrl,
          emailVerified: Boolean(account?.emailVerified),
          passwordEnabled: Boolean(account?.passwordHash),
          googleLinked: Boolean(account?.googleId),
          companyName: company?.name ?? "",
        }}
      />

      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <IconTile size="sm" tone="muted" aria-hidden>
            <Building2 />
          </IconTile>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">Partner-facing organization profile</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Control the private source information and anonymized context used with every brief.</p>
          </div>
        </div>
        <CustomerProfileCard
          initialLinkedin={profile?.linkedinUrl ?? ""}
          initialWebsite={profile?.websiteUrl ?? ""}
          initialRaw={raw}
          initialAnonymized={anon}
        />
      </section>
    </div>
  );
}
