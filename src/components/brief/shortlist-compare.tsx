"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Languages,
  Award,
  BookOpen,
  GripVertical,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { narrowShortlistAction } from "@/lib/actions/admin";

export type ShortlistCard = {
  matchId: string;
  /** "Partner A" pre-reveal, the real name once revealed. */
  displayLabel: string;
  status:
    | "INVITED"
    | "PARTNER_ACCEPTED"
    | "SHORTLISTED"
    | "IN_FINAL_THREE"
    | "PARTNER_DECLINED";
  acceptedAt: string | null;
  customerPriority: number | null;
  // Comparison criteria — capability only pre-reveal.
  regions: string[];
  languages: string[];
  specializations: string[];
  expertiseAreas: string[];
  caseStudies: {
    industry: string | null;
    summary: string | null;
    title: string | null;
    link: string | null;
  }[];
  gcpTier: string | null;
  certifications: { name: string; count?: number; level?: string }[];
  // Post-reveal only.
  revealedPartnerName: string | null;
  revealedTagline: string | null;
  revealedHeadquarters: string | null;
  revealedOfficeLocations: string[];
};

const STATUS_COPY: Record<ShortlistCard["status"], { label: string; tone: "amber" | "success" | "muted" | "danger" }> = {
  INVITED: { label: "Awaiting partner response", tone: "amber" },
  PARTNER_ACCEPTED: { label: "Accepted terms", tone: "success" },
  SHORTLISTED: { label: "Accepted terms", tone: "success" },
  IN_FINAL_THREE: { label: "In your final 3", tone: "success" },
  PARTNER_DECLINED: { label: "Declined", tone: "danger" },
};

const TONE_CLASS: Record<"amber" | "success" | "muted" | "danger", string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  success: "bg-success/10 text-success border-success/30",
  muted: "bg-secondary text-muted-foreground border-border",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function ShortlistCompare({
  briefId,
  briefTitle,
  cards,
}: {
  briefId: string;
  briefTitle: string;
  cards: ShortlistCard[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(
    cards
      .filter((c) => c.status === "IN_FINAL_THREE")
      .sort((a, b) => (a.customerPriority ?? 99) - (b.customerPriority ?? 99))
      .map((c) => c.matchId),
  );
  const [pending, startTransition] = useTransition();

  const eligible = useMemo(
    () =>
      cards.filter((c) =>
        ["PARTNER_ACCEPTED", "SHORTLISTED", "IN_FINAL_THREE"].includes(
          c.status,
        ),
      ),
    [cards],
  );

  function togglePick(matchId: string) {
    setPicked((p) => {
      if (p.includes(matchId)) return p.filter((x) => x !== matchId);
      if (p.length >= 3) {
        toast.error("You can only pick 3 — drop one first");
        return p;
      }
      return [...p, matchId];
    });
  }

  function move(matchId: string, delta: -1 | 1) {
    setPicked((p) => {
      const idx = p.indexOf(matchId);
      if (idx === -1) return p;
      const next = [...p];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return p;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleConfirm() {
    if (picked.length === 0) {
      toast.error("Pick at least one partner");
      return;
    }
    startTransition(async () => {
      const result = await narrowShortlistAction({
        briefId,
        finalThreeMatchIds: picked,
      });
      if (result.ok) {
        toast.success(`Confirmed your top ${picked.length} — meetings coming up.`);
        router.refresh();
      } else {
        toast.error(
          result.error.code === "FORBIDDEN"
            ? "You don't have permission to narrow this shortlist."
            : "Could not confirm",
        );
      }
    });
  }

  const acceptedCount = eligible.length;
  const totalContacted = cards.length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-1/10 text-brand-1 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
          <Sparkles className="h-3 w-3" />
          Shortlist for {briefTitle}
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          Pick your final 3 for meetings
        </h1>
        <p className="text-[13.5px] text-muted-foreground max-w-2xl">
          {acceptedCount} of {totalContacted} contacted partners have accepted
          the terms so far. Compare them on what you told us matters —{" "}
          location & language, expertise, case studies, specialisations — and
          rank up to three you&apos;d like to meet.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const status = STATUS_COPY[c.status];
          const pickIdx = picked.indexOf(c.matchId);
          const canPick = [
            "PARTNER_ACCEPTED",
            "SHORTLISTED",
            "IN_FINAL_THREE",
          ].includes(c.status);
          return (
            <div
              key={c.matchId}
              className={`rounded-2xl border bg-card overflow-hidden flex flex-col ${
                pickIdx >= 0 ? "border-brand-1 shadow-elev-2" : "border-line"
              }`}
            >
              <header className="p-5 border-b border-line space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[15px] font-semibold text-foreground">
                      {c.displayLabel}
                    </h3>
                    {c.revealedTagline ? (
                      <p className="text-[12.5px] text-muted-foreground mt-0.5">
                        {c.revealedTagline}
                      </p>
                    ) : (
                      !c.revealedPartnerName && (
                        <p className="text-[12.5px] text-muted-foreground mt-0.5">
                          Identity stays hidden until you pick your final 3
                        </p>
                      )
                    )}
                  </div>
                  {pickIdx >= 0 && (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-1 text-white text-[11px] font-bold">
                      {pickIdx + 1}
                    </span>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] rounded-full border px-2 py-0.5 ${TONE_CLASS[status.tone]}`}
                >
                  {c.status === "PARTNER_ACCEPTED" ||
                  c.status === "SHORTLISTED" ||
                  c.status === "IN_FINAL_THREE" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {status.label}
                </span>
              </header>

              <div className="p-5 space-y-4 flex-1">
                <Section
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  title="Location & language"
                >
                  <div className="text-[12.5px] text-foreground">
                    {c.revealedHeadquarters ||
                      c.revealedOfficeLocations[0] ||
                      (c.regions.length > 0
                        ? c.regions.slice(0, 3).join(", ")
                        : "Location not provided")}
                    {c.revealedOfficeLocations.length > 1 && (
                      <span className="text-muted-foreground">
                        {" "}
                        · +{c.revealedOfficeLocations.length - 1} other offices
                      </span>
                    )}
                  </div>
                  {c.languages.length > 0 && (
                    <div className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1 mt-1">
                      <Languages className="h-3 w-3" />
                      {c.languages.slice(0, 4).join(", ")}
                    </div>
                  )}
                </Section>

                <Section
                  icon={<Award className="h-3.5 w-3.5" />}
                  title="Specialisations & expertise"
                >
                  <div className="flex flex-wrap gap-1">
                    {(c.specializations.length > 0 ? c.specializations : c.expertiseAreas)
                      .slice(0, 6)
                      .map((s) => (
                        <span
                          key={s}
                          className="text-[10.5px] px-1.5 py-0.5 rounded bg-brand-1/8 text-brand-1 border border-brand-1/15"
                        >
                          {s}
                        </span>
                      ))}
                    {c.specializations.length === 0 && c.expertiseAreas.length === 0 && (
                      <span className="text-[12px] text-muted-foreground italic">
                        Not specified
                      </span>
                    )}
                  </div>
                  {c.gcpTier && (
                    <div className="text-[11.5px] text-muted-foreground mt-1.5">
                      Google Cloud · <span className="font-medium">{c.gcpTier}</span>
                    </div>
                  )}
                </Section>

                <Section
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                  title="Case studies"
                >
                  {c.caseStudies.length === 0 ? (
                    <span className="text-[12px] text-muted-foreground italic">
                      None listed yet
                    </span>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.caseStudies.slice(0, 2).map((cs, i) => (
                        <li
                          key={i}
                          className="text-[12px] text-foreground"
                        >
                          <div className="font-medium">
                            {cs.title ?? cs.summary ?? cs.industry ?? "Case study"}
                          </div>
                          {cs.industry && (
                            <div className="text-[11px] text-muted-foreground">
                              {cs.industry}
                            </div>
                          )}
                          {cs.link && (
                            <a
                              href={cs.link}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[11px] text-brand-1 hover:underline inline-flex items-center gap-1"
                            >
                              Read more
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>

              <footer className="p-4 border-t border-line bg-surface-1">
                {!canPick ? (
                  <div className="text-[11.5px] text-muted-foreground text-center">
                    Waiting for partner response
                  </div>
                ) : pickIdx >= 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => togglePick(c.matchId)}
                    >
                      Drop
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => move(c.matchId, -1)}
                        disabled={pickIdx === 0}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => move(c.matchId, 1)}
                        disabled={pickIdx === picked.length - 1}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => togglePick(c.matchId)}
                    disabled={picked.length >= 3}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                    Add to my top 3
                  </Button>
                )}
              </footer>
            </div>
          );
        })}
      </div>

      {/* Sticky confirm bar */}
      {picked.length > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto max-w-3xl rounded-2xl border border-line bg-card shadow-elev-3 p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-medium">
              {picked.length}/3 selected
            </div>
            <div className="text-[12px] text-muted-foreground">
              Your priority order:{" "}
              {picked
                .map((id, i) => `${i + 1}. ${cards.find((c) => c.matchId === id)?.displayLabel ?? ""}`)
                .join(" · ")}
            </div>
          </div>
          <Button
            type="button"
            size="md"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Confirm final {picked.length}
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
