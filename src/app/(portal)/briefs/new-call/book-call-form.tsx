"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, CheckCircle2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookBriefCallAction } from "@/lib/actions/brief-call";
import { mapErrorToToast } from "@/lib/schemas/errors";

export function BookCallForm() {
  const router = useRouter();
  const [topic, setTopic] = React.useState("");
  const [availability, setAvailability] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [booked, setBooked] = React.useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await bookBriefCallAction({
        topic,
        availabilityNote: availability || undefined,
      });
      if (result.ok) {
        setBooked(result.data.briefId);
      } else {
        setError(mapErrorToToast(result.error));
      }
    });
  };

  if (booked) {
    return (
      <div className="space-y-4 rounded-xl border border-success/25 bg-success/5 p-6 text-center shadow-elev-1 sm:p-8">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success ring-1 ring-success/20"><CheckCircle2 className="h-5 w-5" /></span>
        <h2 className="text-[16px] font-semibold text-foreground">
          Call request received
        </h2>
        <p className="text-[13.5px] text-muted-foreground">
          Our team will reach out to schedule the call. Afterwards you&apos;ll
          get a structured brief to review — we&apos;ll notify you when
          it&apos;s ready.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-elev-2 sm:p-7" aria-busy={pending || undefined}>
      <div className="flex items-start gap-3 border-b border-border pb-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"><CalendarClock className="h-4 w-4" /></span>
        <div><h2 className="text-[15px] font-semibold text-foreground">Call request details</h2><p className="mt-0.5 text-[12.5px] text-muted-foreground">We&apos;ll confirm the final time by email.</p></div>
      </div>
      <label className="block">
        <span className="text-[13px] font-medium text-foreground">
          What&apos;s the project about?
        </span>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Migrate our data warehouse to BigQuery"
          autoComplete="off"
          className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-[13.5px] outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-foreground">
          When are you available?{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </span>
        <textarea
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          rows={3}
          placeholder="e.g. Tuesday–Thursday afternoons, CET"
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-[13.5px] outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
      </label>
      {error && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button
        onClick={submit}
        disabled={topic.trim().length < 3}
        loading={pending}
        leftIcon={pending ? undefined : <PhoneCall className="h-4 w-4" />}
        className="w-full"
      >
        {pending ? "Sending request…" : "Request scoping call"}
      </Button>
    </div>
  );
}
