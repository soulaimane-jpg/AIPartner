"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHALLENGE_AREAS } from "@/lib/challenge-areas";
import { createBriefAction } from "@/lib/actions/briefs";
import type { ServiceCategory } from "@/lib/enums";

export function ProjectRouter({ defaults = [] }: { defaults?: string[] }) {
  const initialServices = useMemo(() => new Set<ServiceCategory>(CHALLENGE_AREAS.filter((area) => defaults.includes(area.key)).map((area) => area.service)), [defaults]);
  const [services, setServices] = useState(initialServices);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const commercial = services.has("RESELLING");
  function toggleService(service: ServiceCategory) {
    setServices((current) => { const next = new Set(current); if (next.has(service)) next.delete(service); else next.add(service); return next; });
  }
  function submit() {
    startTransition(async () => {
      const result = await createBriefAction({
        services: [...services], deliveryModel: [],
        title: title.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Check your selections and try again.")
            : result.error.code === "RATE_LIMITED"
              ? "Too many briefs created — try again in a moment."
              : result.error.code === "FORBIDDEN"
                ? "You don't have permission to start a brief."
                : "Could not create the brief.",
        );
        return;
      }
      window.location.assign(`/briefs/${result.data.briefId}/builder`);
    });
  }

  return <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1 sm:p-7">
    <div className="mb-5 flex items-center justify-between"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary ring-1 ring-primary/15">{commercial ? "Commercial path" : "Technical path"}</span></div>
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-medium">Name your brief</h2>
        <p className="text-[13px] text-muted-foreground">Give your project a descriptive title so you can easily find it later.</p>
      </div>
      <Input
        placeholder="e.g. BigQuery migration for retail analytics"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        className="text-[14px]"
      />
      <div className="pt-2"><h2 className="font-display text-xl font-medium">What do you need help with?</h2><p className="text-[13px] text-muted-foreground">We preselected your signup interests. Update them for this brief.</p></div>
      <div className="grid gap-2 sm:grid-cols-2">{CHALLENGE_AREAS.map((area) => { const selected = services.has(area.service); return <button key={area.key} type="button" aria-pressed={selected} onClick={() => toggleService(area.service)} className={`relative rounded-xl border p-4 text-left ${selected ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]" : "border-border"}`}><Check className={`absolute right-3 top-3 h-4 w-4 text-primary ${selected ? "opacity-100" : "opacity-0"}`} /><span className="block pr-6 text-[13px] font-semibold">{area.title}</span><span className="mt-1 block text-[12px] text-muted-foreground">{area.description}</span></button>; })}</div>
      <div className="flex justify-end"><Button disabled={!services.size || pending} onClick={submit}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Create brief</Button></div>
    </div>
  </div>;
}
