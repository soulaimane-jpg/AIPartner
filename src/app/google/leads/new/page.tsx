import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { GooglerSubmitLeadForm } from "@/components/googler-submit-lead-form";

export const metadata = { title: "Refer a customer · Google Portal" };

export default function SubmitLeadPage() {
  return (
    <div className="space-y-8 pb-20 max-w-3xl">
      <div>
        <Link
          href="/google"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Refer a customer
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              We&apos;ll generate a personalized invite email and surface their
              progress on your leads page as they move through AI Partner.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6">
        <GooglerSubmitLeadForm />
      </div>
    </div>
  );
}
