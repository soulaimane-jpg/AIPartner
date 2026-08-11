import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand";

/**
 * Auth-style layout for the post-signup onboarding wizard. Two-column on
 * desktop (left brand panel + right form), single-column on mobile.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-background">
      <aside className="relative isolate hidden lg:flex flex-col justify-between overflow-hidden bg-hero-purple text-white p-12">
        <div aria-hidden className="bg-aurora" />
        <div aria-hidden className="bg-noise" />
        <div className="relative">
          <BrandLockup size="md" inverse />
        </div>
        <div className="relative space-y-5 max-w-md">
          <h2 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
            One quiet workspace for sourcing GCP work end-to-end.
          </h2>
          <ul className="space-y-2 text-[14px] text-white/80">
            <li>• AI-guided brief in under 15 minutes</li>
            <li>• Vetted Google Cloud Premier partners</li>
            <li>• Compare proposals side-by-side</li>
          </ul>
        </div>
        <p className="relative text-[11.5px] uppercase tracking-[0.16em] text-white/50">
          Confidential — your colleagues only see what you share.
        </p>
      </aside>
      <main className="flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="absolute top-5 left-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Skip to workspace
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
