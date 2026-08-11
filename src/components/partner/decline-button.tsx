"use client";

/**
 * Tiny client wrapper that ties the partner inbox decline button to
 * the structured-reason dialog. Keeps the surrounding page server-only.
 *
 * Hidden when the match has already moved past the "invited" /
 * "sourced" stage — declining after acceptance has different
 * semantics (and goes through the proposal-withdraw flow instead).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeclineReasonDialog } from "./decline-reason-dialog";

const DECLINABLE_STATUSES = new Set<string>();

export function PartnerDeclineButton({
  matchId,
  matchStatus,
  briefTitle,
}: {
  matchId: string;
  matchStatus: string;
  briefTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!DECLINABLE_STATUSES.has(matchStatus)) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive"
      >
        <XCircle className="h-3.5 w-3.5" />
        Decline lead
      </Button>
      {open && (
        <DeclineReasonDialog
          matchId={matchId}
          briefTitle={briefTitle}
          onClose={() => setOpen(false)}
          onDeclined={() => router.push("/partner/opportunities")}
        />
      )}
    </>
  );
}
