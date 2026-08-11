"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock3, Loader2, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scheduleCustomerMeetingAction } from "@/lib/actions/customer-meetings";

export function CustomerScheduleMeetingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("Meeting with AI Partner");
  const [startsAt, setStartsAt] = useState(defaultStartsAt());
  const [durationMin, setDurationMin] = useState(30);
  const [agenda, setAgenda] = useState("");

  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await scheduleCustomerMeetingAction({
        title,
        startsAt: new Date(startsAt).toISOString(),
        durationMin,
        timeZone: tz,
        agenda: agenda || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Meeting scheduled! Confirmation emails are on the way.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[560px] gap-0 overflow-y-auto border-primary/10 p-0 sm:rounded-3xl">
        <DialogHeader className="border-b border-border bg-[radial-gradient(circle_at_90%_0%,hsl(var(--primary)/0.16),transparent_18rem),linear-gradient(145deg,hsl(var(--surface-2)),hsl(var(--card))_70%)] px-5 py-5 pr-14 sm:px-6 sm:py-6">
          <div className="flex items-start gap-3.5 text-left">
            <IconTile size="md" tone="indigo" aria-hidden>
              <CalendarDays />
            </IconTile>
            <div>
              <DialogTitle className="text-[19px]">Schedule a meeting</DialogTitle>
              <DialogDescription className="mt-1 max-w-md">
                Choose a time for a Google Meet call with the AI Partner team. A calendar invitation and meeting link will be emailed to you.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-primary">
                <Video className="h-4 w-4" /> Google Meet
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">Your call will be added to your Calls workspace and the team&apos;s calendar.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-meeting-title" className="text-[12.5px] font-semibold">Meeting title</Label>
              <Input
                id="cust-meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="What should we call this meeting?"
                className="h-11"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(150px,0.7fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="cust-meeting-start" className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Date & time
                </Label>
                <Input
                  id="cust-meeting-start"
                  type="datetime-local"
                  value={startsAt}
                  min={minStartsAt()}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-meeting-duration" className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <Clock3 className="h-3.5 w-3.5 text-muted-foreground" /> Duration
                </Label>
                <Select value={String(durationMin)} onValueChange={(value) => setDurationMin(Number(value))}>
                  <SelectTrigger id="cust-meeting-duration" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90].map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> Times are shown in {tz}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-meeting-agenda" className="text-[12.5px] font-semibold">Agenda <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="cust-meeting-agenda"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="Share goals, context, or questions so the team can prepare."
                className="min-h-28 resize-y"
              />
              <div className="text-right text-[10.5px] tabular-nums text-muted-foreground">{agenda.length}/4000</div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border bg-secondary/25 px-5 py-4 sm:px-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || title.trim().length < 2}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {pending ? "Scheduling…" : "Confirm meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultStartsAt(): string {
  const date = new Date(Date.now() + 24 * 60 * 60_000);
  date.setSeconds(0, 0);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 9);
  if (date.getTime() < Date.now()) {
    date.setTime(Date.now() + 2 * 60 * 60_000);
    date.setMinutes(0, 0, 0);
  }
  return localDateTime(date);
}

function minStartsAt(): string {
  return localDateTime(new Date(Date.now() + 5 * 60_000));
}

function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
