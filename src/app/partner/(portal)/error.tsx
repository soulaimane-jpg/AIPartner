"use client";

import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PartnerPortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-container-wide portal-page py-10 sm:py-14">
      <Card className="mx-auto max-w-xl border-line bg-card shadow-elev-1">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-red-100 bg-red-50 text-red-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-[20px] font-semibold tracking-tight text-foreground">The partner workspace could not load</h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Your data is safe. Try loading the page again, or return to the overview if the problem continues.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner">Return to overview</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
