"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleAlert,
  FileSignature,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptEngagementAction } from "@/lib/actions/engagements";
import { formatCurrency } from "@/lib/utils";

export type EngagementDTO = {
  id: string;
  briefId: string;
  briefTitle: string;
  status: string;
  /** Firewalled: the real name only once identities are revealed. */
  partnerLabel: string;
  acceptedScope: string | null;
  contractValueCents: number | null;
  currency: string;
  startDate: string | null;
  durationMonths: number | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  deliveredAt: string | null;
  milestones: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    status: string;
  }[];
};

const MILESTONE_ICON: Record<string, typeof Circle> = {
  PENDING: Circle,
  IN_PROGRESS: CircleDashed,
  COMPLETED: CheckCircle2,
  BLOCKED: CircleAlert,
};

export function EngagementView({ engagement }: { engagement: EngagementDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [authority, setAuthority] = useState(false);

  const awaiting = engagement.status === "PENDING_ACCEPTANCE";

  function accept() {
    startTransition(async () => {
      const result = await acceptEngagementAction({
        engagementId: engagement.id,
        acceptedByName: name.trim(),
        authorityChecked: authority,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      if (result.ok) {
        toast.success("Engagement confirmed");
        router.refresh();
      } else {
        toast.error(
          "reason" in result.error && result.error.reason
            ? result.error.reason
            : "Could not confirm the engagement",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
          <FileSignature className="h-3 w-3" />
          Engagement
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          {engagement.briefTitle}
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          With {engagement.partnerLabel}
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-card overflow-hidden">
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Fact
            label="Contract value"
            value={
              engagement.contractValueCents !== null
                ? formatCurrency(engagement.contractValueCents)
                : "Not stated"
            }
          />
          <Fact
            label="Start"
            value={
              engagement.startDate
                ? new Date(engagement.startDate).toLocaleDateString()
                : "To be agreed"
            }
          />
          <Fact
            label="Duration"
            value={
              engagement.durationMonths
                ? `${engagement.durationMonths} months`
                : "Not stated"
            }
          />
        </div>

        {engagement.acceptedScope && (
          <div className="p-5 border-t border-line">
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-2">
              Agreed scope
            </h2>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
              {engagement.acceptedScope}
            </p>
          </div>
        )}
      </section>

      {awaiting ? (
        <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 space-y-3">
          <h2 className="text-[14px] font-semibold">Confirm this engagement</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Confirming records your acceptance of the scope and commercial
            terms above. We keep a timestamped record of who confirmed.
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="max-w-sm"
          />
          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={authority}
              onChange={(e) => setAuthority(e.target.checked)}
              className="mt-0.5"
            />
            I have authority to accept on behalf of my company.
          </label>
          <Button
            onClick={accept}
            disabled={pending || name.trim().length < 2 || !authority}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm engagement
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2 text-[13.5px] font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            {engagement.status === "DELIVERED"
              ? "Delivered"
              : "Confirmed"}
          </div>
          {engagement.acceptedAt && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Accepted by {engagement.acceptedByName} on{" "}
              {new Date(engagement.acceptedAt).toLocaleString()}
              {engagement.deliveredAt &&
                ` · delivered ${new Date(engagement.deliveredAt).toLocaleDateString()}`}
            </p>
          )}
        </section>
      )}

      {engagement.milestones.length > 0 && (
        <section className="rounded-2xl border border-line bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Delivery milestones
          </div>
          <ul className="divide-y divide-line">
            {engagement.milestones.map((m) => {
              const Icon = MILESTONE_ICON[m.status] ?? Circle;
              return (
                <li key={m.id} className="flex items-start gap-3 px-5 py-3.5">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      m.status === "COMPLETED"
                        ? "text-success"
                        : m.status === "BLOCKED"
                          ? "text-danger"
                          : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{m.title}</div>
                    {m.description && (
                      <p className="text-[12.5px] text-muted-foreground">
                        {m.description}
                      </p>
                    )}
                    {m.dueDate && (
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Due {new Date(m.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
