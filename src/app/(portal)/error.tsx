"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-container py-10 sm:py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-elev-2 sm:p-8">
        <span className="portal-icon-box mx-auto" aria-hidden>
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-foreground">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Your work is safe. Try loading the page again. If the issue continues, contact support
          {error.digest ? ` with reference ${error.digest}` : ""}.
        </p>
        <Button onClick={reset} className="mt-6">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
