import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { GooglerSubmitLeadForm } from "@/components/googler-submit-lead-form";
import { requireGoogler } from "@/lib/require-role";

export const metadata = { title: "Refer a customer · Google Portal" };

export default async function SubmitLeadPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireGoogler();

  return (
    <div className="page-container portal-page max-w-4xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box" aria-hidden>
            <UserPlus className="h-[18px] w-[18px]" />
          </span>
          <div>
            <Link
              href="/google"
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
            </Link>
            <h1 className="portal-page-title">Refer a customer</h1>
            <p className="portal-page-description">
              We&apos;ll generate a personalized invite email and surface their
              progress on your leads page as they move through AI Partner.
            </p>
          </div>
        </div>
      </header>

      <div className="customer-panel p-5 sm:p-6">
        <GooglerSubmitLeadForm />
      </div>
    </div>
  );
}
