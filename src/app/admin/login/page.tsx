import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { SignInForm } from "@/components/auth-form";
import { Logo } from "@/components/brand";

export const metadata = { title: "Admin Access · AI Partner" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dot-grid opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-destructive/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="md" showBadge={false} />
        </div>

        {/* Restricted badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 border border-destructive/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-destructive">
            <ShieldAlert className="h-3.5 w-3.5" />
            Restricted Access
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-destructive/15 bg-card p-8 shadow-[0_0_0_1px_hsl(0_84%_58%/0.08),0_24px_48px_-12px_hsl(220_25%_0%/0.5)]">
          <Suspense>
            <SignInForm
              role="ADMIN"
              title="Admin Console"
              subtitle="Authenticate with platform staff credentials to access the control center."
              submitLabel="Authorize Access"
            />
          </Suspense>
        </div>

        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground/40">
          AI Partner Internal Systems · v4.0
        </p>
      </div>
    </div>
  );
}
