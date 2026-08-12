"use client";

/**
 * Pending domain-matched join requests.
 *
 * Approving shares every brief in the workspace, so the copy says so
 * plainly rather than presenting this as a routine confirmation.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  approveJoinRequestAction,
  declineJoinRequestAction,
} from "@/lib/actions/workspace-invites";

export type JoinRequestRow = {
  id: string;
  requesterName: string | null;
  requesterEmail: string;
  emailDomain: string;
};

export function JoinRequests({ requests }: { requests: JoinRequestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function resolve(id: string, approve: boolean) {
    startTransition(async () => {
      const result = approve
        ? await approveJoinRequestAction({ requestId: id })
        : await declineJoinRequestAction({ requestId: id });
      if (result.ok) {
        toast.success(approve ? "Added to the workspace" : "Request declined");
        router.refresh();
      } else {
        toast.error(
          "reason" in result.error && result.error.reason
            ? result.error.reason
            : "Could not update the request",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      <header className="border-b border-amber-200 px-5 py-4">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <UserPlus className="h-4 w-4 text-amber-600" />
          {requests.length} request{requests.length === 1 ? "" : "s"} to join
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          These people signed up with your company&apos;s email domain.
          Approving gives them access to every brief in this workspace.
        </p>
      </header>
      <ul className="divide-y divide-amber-200/70">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-foreground">
                {r.requesterName ?? r.requesterEmail}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {r.requesterEmail} · matched on @{r.emailDomain}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => resolve(r.id, true)}
                disabled={pending}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve(r.id, false)}
                disabled={pending}
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
