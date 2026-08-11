import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPendingLegalDocs } from "@/lib/legal/documents";
import type { UserRole } from "@/lib/enums";
import { LegalAcceptForm } from "./legal-accept-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terms & NDA · AI Partner" };

/**
 * Legal acceptance gate — plan-A M1. `PortalShell` redirects here
 * until the user has accepted the current version of every required
 * document for their role. Deliberately outside the portal route
 * groups so it can't gate itself.
 */
export default async function LegalAcceptPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/legal/accept");

  const role = (session.user.role ?? "CUSTOMER") as UserRole;
  const pending = await getPendingLegalDocs(session.user.id, role);

  const home = role === "PARTNER" ? "/partner" : "/dashboard";
  if (pending.length === 0) redirect(home);

  return (
    <main className="min-h-screen bg-secondary/30 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Before you continue
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl mx-auto">
            Please review and accept the current version of the following
            document{pending.length > 1 ? "s" : ""}. You&apos;ll be asked again
            whenever a new version is published.
          </p>
        </div>
        <LegalAcceptForm
          documents={pending}
          defaultName={session.user.name ?? ""}
          nextHref={home}
        />
      </div>
    </main>
  );
}
