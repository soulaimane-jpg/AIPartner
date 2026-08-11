import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand";
import { AuthAside } from "./auth-aside";

const DEFAULT_VALUE_POINTS = [
  "AI-powered scoping that turns your idea into a partner-ready brief",
  "Compare proposals side-by-side and pick with confidence",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid bg-background lg:grid-cols-[minmax(460px,0.92fr)_minmax(560px,1.08fr)]">
      {/* Left panel — cinema-dark, animated, brand-led */}
      <AuthAside valuePoints={DEFAULT_VALUE_POINTS} />

      {/* Right panel — form */}
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-20 sm:px-8 lg:px-12">
        <div className="absolute left-5 top-5 sm:left-8 sm:top-7">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>

        <div className="w-full max-w-[440px] rounded-3xl border border-line/80 bg-card/95 p-6 shadow-elev-3 sm:p-9 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="flex justify-center lg:hidden mb-8">
            <Logo size="md" showBadge={false} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
