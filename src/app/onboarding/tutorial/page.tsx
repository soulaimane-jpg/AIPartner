import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { TutorialOverlay } from "@/components/onboarding/tutorial-overlay";

export const metadata = { title: "Quick tour · AI Partner" };
export const dynamic = "force-dynamic";

export default async function TutorialPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; replay?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in?next=/onboarding/tutorial");
  }

  const { next, replay } = await searchParams;

  const user = await queryOne<{ onboardedAt: Date | null; role: string }>(
    'SELECT "onboardedAt", "role" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );

  // Already onboarded and not explicitly replaying? Send to workspace.
  if (user?.onboardedAt && !replay) {
    redirect(next ?? "/dashboard");
  }
  if (user?.role !== "CUSTOMER") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-cinema-bg/40">
      <TutorialOverlay next={next} />
    </div>
  );
}
