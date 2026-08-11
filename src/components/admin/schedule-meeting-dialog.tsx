"use client";

/**
 * Admin "Schedule Meeting" dialog.
 *
 * Supports two modes:
 *   - "instant": fires immediately, 30-minute duration, Meet link.
 *   - "scheduled": admin picks date / time / duration (15..240 min).
 *
 * Attendees can be: customer-only, partner-only, or both. When a brief
 * is provided we auto-derive participants; otherwise the admin picks
 * a partner company explicitly (and may add a customer email).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  Zap,
  Users,
  Building2,
  UserCircle,
  Link2,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  createInstantMeetingAction,
  createScheduledMeetingAction,
} from "@/lib/actions/meetings";
import { mapErrorToToast } from "@/lib/schemas/errors";

export interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional brief context — auto-fills attendees. */
  brief?: {
    id: string;
    title: string;
    customerName?: string | null;
    customerEmail?: string | null;
    matchedPartners?: { id: string; name: string }[];
  };
  /** Partner directory for the picker (used when no brief is set). */
  partners?: { id: string; name: string }[];
  /** Customer directory for the picker (used when no brief is set). */
  customers?: {
    id: string;
    email: string;
    name: string | null;
    companyName?: string | null;
  }[];
  /** Default to instant or scheduled. */
  defaultKind?: "instant" | "scheduled";
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  brief,
  partners = [],
  customers = [],
  defaultKind = "scheduled",
}: ScheduleMeetingDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"instant" | "scheduled">(defaultKind);
  const [title, setTitle] = useState(
    brief ? `Sync: ${brief.title}` : "Customer ↔ Partner sync",
  );
  const [agenda, setAgenda] = useState("");
  const [includeCustomer, setIncludeCustomer] = useState(true);
  const [includePartner, setIncludePartner] = useState(true);
  const [partnerCompanyId, setPartnerCompanyId] = useState<string>(
    brief?.matchedPartners?.[0]?.id ?? partners[0]?.id ?? "",
  );
  const [customerUserId, setCustomerUserId] = useState<string>("");
  const [startsAt, setStartsAt] = useState(defaultStartsAt());
  const [durationMin, setDurationMin] = useState(30);

  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!includeCustomer && !includePartner) {
      toast.error("Select at least one attendee.");
      return;
    }
    if (includeCustomer && !brief && !customerUserId) {
      toast.error("Pick a customer, or turn off the Customer attendee.");
      return;
    }
    if (includePartner && !brief && !partnerCompanyId) {
      toast.error("Pick a partner, or turn off the Partner attendee.");
      return;
    }
    const selectedCustomer =
      customers.find((c) => c.id === customerUserId) ?? null;
    startTransition(async () => {
      const sharedInput = {
        briefId: brief?.id ?? null,
        includeCustomer,
        includePartner,
        partnerCompanyId: partnerCompanyId || null,
        customerEmailOverride: selectedCustomer?.email || null,
        customerUserId: customerUserId || null,
        title,
        agenda: agenda || null,
      };

      const result =
        kind === "instant"
          ? await createInstantMeetingAction(sharedInput)
          : await createScheduledMeetingAction({
              ...sharedInput,
              startsAt: new Date(startsAt).toISOString(),
              durationMin,
              timeZone: tz,
            });

      if (!result.ok) {
        if (
          result.error.code === "FORBIDDEN" &&
          result.error.reason === "calendar_not_connected"
        ) {
          toast.error(
            "Connect your Google Calendar first (Meetings → Connect).",
          );
          onOpenChange(false);
          router.push("/admin/meetings?error=not_connected");
          return;
        }
        toast.error(mapErrorToToast(result.error));
        return;
      }

      toast.success(
        kind === "instant"
          ? "Instant meeting created — invites on the way."
          : "Meeting scheduled — invites on the way.",
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  const partnerOptions = brief?.matchedPartners?.length
    ? brief.matchedPartners
    : partners;
  const partnerComboOptions = partnerOptions.map((p) => ({
    value: p.id,
    label: p.name,
  }));
  const customerComboOptions = customers.map((c) => ({
    value: c.id,
    label: c.name || c.email,
    description: c.companyName ?? c.email,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            Schedule meeting
          </DialogTitle>
          <DialogDescription>
            Create a Google Calendar event with a Meet link. Google sends
            the invite to every attendee.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("scheduled")}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                kind === "scheduled"
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Scheduled
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Pick a date and time.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setKind("instant")}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all",
                kind === "instant"
                  ? "border-amber-500 bg-amber-50 ring-1 ring-amber-200"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Zap className="h-4 w-4 text-amber-600" />
                Instant
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Starts now · 30 minutes.
              </div>
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-title">Meeting title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
            />
          </div>

          {/* Schedule fields */}
          {kind === "scheduled" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-start">Starts</Label>
                <Input
                  id="meeting-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
                <div className="text-[11px] text-slate-500">
                  Timezone: {tz}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-duration">Duration</Label>
                <Select
                  value={String(durationMin)}
                  onValueChange={(v) => setDurationMin(Number(v))}
                >
                  <SelectTrigger id="meeting-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Attendees */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              Attendees
            </Label>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/60">
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-800">
                  <UserCircle className="h-4 w-4 text-blue-600" />
                  Customer
                  {brief?.customerName && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {brief.customerName}
                    </Badge>
                  )}
                </span>
                <Switch
                  checked={includeCustomer}
                  onCheckedChange={setIncludeCustomer}
                />
              </label>
              {includeCustomer && !brief && customerComboOptions.length > 0 && (
                <Combobox
                  options={customerComboOptions}
                  value={customerUserId || null}
                  onChange={setCustomerUserId}
                  placeholder="Select a customer"
                  searchPlaceholder="Search customers…"
                  emptyText="No customers found."
                />
              )}
              {includeCustomer &&
                !brief &&
                customerComboOptions.length === 0 && (
                  <div className="text-xs text-amber-700 pl-6">
                    No customers found yet.
                  </div>
                )}
              {includeCustomer && brief?.customerEmail && (
                <div className="text-xs text-slate-500 pl-6">
                  Invite goes to{" "}
                  <span className="font-mono">{brief.customerEmail}</span>
                </div>
              )}

              <div className="h-px bg-slate-200/70" />

              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-800">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Partner
                </span>
                <Switch
                  checked={includePartner}
                  onCheckedChange={setIncludePartner}
                />
              </label>
              {includePartner && partnerComboOptions.length > 0 && (
                <Combobox
                  options={partnerComboOptions}
                  value={partnerCompanyId || null}
                  onChange={setPartnerCompanyId}
                  placeholder="Choose a partner"
                  searchPlaceholder="Search partners…"
                  emptyText="No partners found."
                />
              )}
              {includePartner && partnerOptions.length === 0 && (
                <div className="text-xs text-amber-700 pl-6">
                  No partner available — assign a partner to this brief
                  first.
                </div>
              )}
            </div>
          </div>

          {/* Agenda */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-agenda">Agenda (optional)</Label>
            <textarea
              id="meeting-agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Discuss SoW, next steps, success criteria…"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {brief && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-slate-400" />
              Linked to brief{" "}
              <span className="font-semibold text-slate-800">
                {brief.title}
              </span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creating…
                </>
              ) : kind === "instant" ? (
                <>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Start now
                </>
              ) : (
                <>
                  <CalendarClock className="h-4 w-4 mr-1.5" />
                  Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Default `datetime-local` value: 1 hour from now, rounded to next :00 / :30. */
function defaultStartsAt(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setSeconds(0, 0);
  // Snap to next half-hour for niceness.
  const minutes = d.getMinutes();
  d.setMinutes(minutes < 30 ? 30 : 0, 0, 0);
  if (minutes >= 30) d.setHours(d.getHours() + 1);
  // datetime-local needs YYYY-MM-DDTHH:MM in the user's local TZ.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
