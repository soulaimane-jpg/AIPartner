import { auth } from "@/lib/auth";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <div className="relative flex min-h-screen flex-col">
      <MarketingHeader cinema signedIn={!!session?.user} role={session?.user?.role ?? null} />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
