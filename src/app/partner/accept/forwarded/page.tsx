import Link from "next/link";
import { Forward } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Forwarded · AI Partner" };

export default async function ForwardedPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const { to } = await searchParams;
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-cinema-bg border-b border-[hsl(268_25%_16%)]">
        <div className="container-app h-14 flex items-center">
          <BrandLockup size="sm" inverse />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-brand-1/10 text-brand-1">
            <Forward className="h-7 w-7" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Forwarded to your colleague
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            We&apos;ve sent the link to the address you provided. You can close
            this tab — only their copy of the link will work from now on.
          </p>
          {to && (
            <p className="text-[11.5px] font-mono text-muted-foreground break-all">
              {to}
            </p>
          )}
          <Button asChild variant="outline" size="md">
            <Link href="/">Back to AI Partner</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
