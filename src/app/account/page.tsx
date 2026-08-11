import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account · AI Partner" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/account");

  const initials =
    (session.user.name || session.user.email || "?")
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "·";
  const customerProfileLink = {
    href: "/profile",
    icon: UserRound,
    title: "Profile",
    description:
      "Update your photo, personal details, sign-in options, and partner-facing organization profile.",
  };

  return (
    <div className="page-container portal-page max-w-5xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-elev-2"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="eyebrow">Account</div>
            <h1 className="portal-page-title truncate">
              {session.user.name || "Your account"}
            </h1>
            <p className="portal-page-description truncate">
              {session.user.email} · {session.user.role}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="account-settings-heading" className="space-y-4">
        <div>
          <h2 id="account-settings-heading" className="text-[17px] font-semibold text-foreground">
            Settings
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Manage your profile and account security.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {session.user.role === "CUSTOMER" && (
            <AccountLink {...customerProfileLink} />
          )}
          <AccountLink
            href="/account/security"
            icon={ShieldCheck}
            title="Security"
            description="Manage two-factor authentication, passkeys, active sessions, and your data."
          />
        </div>
      </section>
    </div>
  );
}

function AccountLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <Card interactive className="customer-panel overflow-hidden">
      <Link
        href={href}
        className={cn(
          "group flex min-h-40 flex-col p-5 sm:p-6",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
        )}
      >
        <span className="portal-icon-box mb-5">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[12.5px] font-medium text-primary">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-160 group-hover:translate-x-0.5" />
        </span>
      </Link>
    </Card>
  );
}
