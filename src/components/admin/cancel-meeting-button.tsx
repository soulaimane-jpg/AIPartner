"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelMeetingAction } from "@/lib/actions/meetings";
import { mapErrorToToast } from "@/lib/schemas/errors";

export function CancelMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm("Cancel this meeting? Attendees will be notified.")) {
      return;
    }
    startTransition(async () => {
      const result = await cancelMeetingAction({ meetingId });
      if (!result.ok) {
        toast.error(mapErrorToToast(result.error));
        return;
      }
      toast.success("Meeting cancelled.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="text-red-600 hover:text-red-700 hover:bg-red-50"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <XCircle className="h-3.5 w-3.5 mr-1" />
      )}
      Cancel
    </Button>
  );
}
