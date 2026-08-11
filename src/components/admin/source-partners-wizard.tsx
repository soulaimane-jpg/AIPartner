"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Mail,
  Pencil,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { sourcePartnersAction } from "@/lib/actions/admin";
import {
  DEFAULT_PARTNER_OUTREACH_BODY,
  DEFAULT_PARTNER_OUTREACH_SUBJECT,
  renderTemplate,
} from "@/lib/email-templates";

export type PartnerCandidate = {
  id: string;
  name: string;
  tagline: string | null;
  tier: string | null;
  headquarters: string | null;
  languages: string[];
  specializations: string[];
  expertiseAreas: string[];
  defaultEmail: string | null;
  matchScore: number;
  matchLabel: string;
  /**
   * False when a hard gate failed — below the partner's minimum deal size,
   * unable to mobilise in time, or missing required compliance. Gated partners
   * stay selectable: an admin may know something the structured data doesn't.
   */
  eligible?: boolean;
  gates?: string[];
};

const GATE_COPY: Record<string, string> = {
  budget_below_minimum: "Below their minimum project size",
  cannot_start_in_time: "Cannot start in time",
  missing_required_compliance: "Missing required compliance",
};

type Step = 1 | 2 | 3;

type Selection = {
  partnerId: string;
  recipientEmail: string;
  customSubject: string;
  customBody: string;
};

export function SourcePartnersWizard({
  briefId,
  briefTitle,
  briefSummary,
  customerIndustry,
  customerRegion,
  candidates,
}: {
  briefId: string;
  briefTitle: string;
  briefSummary: string;
  customerIndustry: string;
  customerRegion: string;
  candidates: PartnerCandidate[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState("");
  const initiallySelected = candidates.slice(0, 5).map((c) => c.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(initiallySelected);

  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, Partial<Selection>>>(
    {},
  );
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tagline?.toLowerCase().includes(q) ||
        c.specializations.some((s) => s.toLowerCase().includes(q)),
    );
  }, [candidates, search]);

  function toggle(id: string) {
    setSelectedIds((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 5) {
        toast.error("You can only source 5 partners — deselect one first");
        return s;
      }
      return [...s, id];
    });
  }

  function renderFor(partner: PartnerCandidate): {
    subject: string;
    body: string;
    recipientEmail: string;
  } {
    const vars = {
      partnerName: partner.name,
      partnerCompany: partner.name,
      recipientEmail: partner.defaultEmail ?? "",
      customerIndustry,
      customerRegion,
      briefSummary,
      briefTitle,
      acceptUrl: "{{acceptUrl}}", // generated server-side at send time
    };
    const subject = renderTemplate(DEFAULT_PARTNER_OUTREACH_SUBJECT, vars);
    const body = renderTemplate(DEFAULT_PARTNER_OUTREACH_BODY, vars);
    const override = overrides[partner.id] ?? {};
    return {
      subject: override.customSubject ?? subject,
      body: override.customBody ?? body,
      recipientEmail: override.recipientEmail ?? partner.defaultEmail ?? "",
    };
  }

  function patchOverride(partnerId: string, patch: Partial<Selection>) {
    setOverrides((o) => ({ ...o, [partnerId]: { ...o[partnerId], ...patch } }));
  }

  const selectedPartners = selectedIds
    .map((id) => candidates.find((c) => c.id === id))
    .filter((p): p is PartnerCandidate => !!p);

  function handleSend() {
    const selections = selectedPartners.map((p) => {
      const r = renderFor(p);
      return {
        partnerId: p.id,
        recipientEmail: r.recipientEmail,
        customSubject: overrides[p.id]?.customSubject,
        customBody: overrides[p.id]?.customBody,
      };
    });
    const missing = selections.filter((s) => !s.recipientEmail);
    if (missing.length > 0) {
      toast.error(
        `${missing.length} partner${missing.length === 1 ? "" : "s"} missing an email — fix in step 2`,
      );
      setStep(2);
      return;
    }
    startTransition(async () => {
      const res = await sourcePartnersAction({ briefId, selections });
      if (res.ok) {
        toast.success(`Sourced ${res.data.invited} partners — outreach sent`);
        router.refresh();
      } else {
        toast.error(
          res.error.code === "INVALID_INPUT"
            ? (res.error.issues[0]?.message ?? "Validation failed")
            : "Could not source partners",
        );
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden">
      <header className="px-6 py-4 border-b border-line bg-surface-1">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-1/10 text-brand-1">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-semibold">Source 5 partners</h2>
            <p className="text-[12px] text-muted-foreground">
              Step {step} of 3 ·{" "}
              {step === 1
                ? "Choose"
                : step === 2
                  ? "Personalise outreach"
                  : "Confirm & send"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full ${
                  i <= step ? "bg-brand-1" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* STEP 1 — Select up to 5 */}
      {step === 1 && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, specialization…"
                className="pl-9"
              />
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {selectedIds.length}/5 selected
            </div>
          </div>

          <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto rounded-lg border border-line">
            {filtered.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <li
                  key={p.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer ${
                    selected ? "bg-brand-1/5" : "hover:bg-surface-1"
                  }`}
                  onClick={() => toggle(p.id)}
                >
                  <div
                    className={`mt-0.5 grid h-5 w-5 place-items-center rounded-md border ${
                      selected
                        ? "bg-brand-1 border-brand-1 text-white"
                        : "border-line bg-card"
                    }`}
                  >
                    {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[13.5px] text-foreground">
                        {p.name}
                      </span>
                      {p.tier && (
                        <span className="text-[10px] uppercase tracking-[0.06em] font-semibold bg-amber-100 text-amber-900 rounded px-1.5 py-0.5">
                          {p.tier}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {p.matchScore}/100 · {p.matchLabel}
                      </span>
                      {p.eligible === false &&
                        (p.gates ?? []).map((g) => (
                          <span
                            key={g}
                            className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-700"
                          >
                            {GATE_COPY[g] ?? g}
                          </span>
                        ))}
                    </div>
                    {p.tagline && (
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {p.tagline}
                      </p>
                    )}
                    {p.specializations.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.specializations.slice(0, 5).map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-[13px] text-muted-foreground italic">
                No partners match that search.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* STEP 2 — Personalise per partner */}
      {step === 2 && (
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {selectedPartners.map((p) => {
            const rendered = renderFor(p);
            const isEditing = editing[p.id];
            return (
              <div
                key={p.id}
                className="rounded-xl border border-line bg-surface-1 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-[13.5px] text-foreground">
                      {p.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Match {p.matchScore}/100 · {p.matchLabel}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing((e) => ({ ...e, [p.id]: !e[p.id] }))
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isEditing ? "Done editing" : "Customise"}
                  </Button>
                </div>

                <FormField
                  label="Recipient email"
                  htmlFor={`em-${p.id}`}
                  error={
                    !rendered.recipientEmail
                      ? "Partner profile has no lead-routing email — add one here"
                      : undefined
                  }
                >
                  <Input
                    id={`em-${p.id}`}
                    type="email"
                    value={rendered.recipientEmail}
                    onChange={(e) =>
                      patchOverride(p.id, { recipientEmail: e.target.value })
                    }
                    placeholder="sales@partner.com"
                  />
                </FormField>

                {isEditing ? (
                  <>
                    <FormField label="Subject" htmlFor={`sub-${p.id}`}>
                      <Input
                        id={`sub-${p.id}`}
                        value={rendered.subject}
                        onChange={(e) =>
                          patchOverride(p.id, { customSubject: e.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="Body" htmlFor={`body-${p.id}`}>
                      <Textarea
                        id={`body-${p.id}`}
                        rows={10}
                        value={rendered.body}
                        onChange={(e) =>
                          patchOverride(p.id, { customBody: e.target.value })
                        }
                        className="font-mono text-[12px]"
                      />
                    </FormField>
                  </>
                ) : (
                  <details className="rounded-md bg-card border border-line p-3">
                    <summary className="text-[12px] font-medium text-muted-foreground cursor-pointer">
                      Preview rendered email
                    </summary>
                    <div className="mt-2 text-[12px] text-foreground space-y-2">
                      <div>
                        <span className="text-muted-foreground">Subject: </span>
                        {rendered.subject}
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-[11.5px] bg-surface-1 p-2 rounded border border-line">
                        {rendered.body}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 3 — Confirm */}
      {step === 3 && (
        <div className="p-6 space-y-4">
          <p className="text-[13.5px] text-foreground">
            Ready to send outreach to{" "}
            <strong>{selectedPartners.length} partners</strong>. Each will get a
            unique tokenised link to accept our terms of conditions.
          </p>
          <ul className="rounded-lg border border-line divide-y divide-line">
            {selectedPartners.map((p) => {
              const r = renderFor(p);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div>
                    <div className="font-medium text-[13.5px]">{p.name}</div>
                    <div className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      {r.recipientEmail || "(no email — fix in step 2)"}
                    </div>
                  </div>
                  <div className="text-[11.5px] font-mono text-muted-foreground">
                    {p.matchScore}/100
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[12.5px] text-amber-900">
            On send, the brief will move from <strong>SOURCING</strong> to{" "}
            <strong>SHORTLIST</strong>. The customer sees a card per partner as
            they accept the terms.
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 px-6 py-4 bg-surface-1 border-t border-line">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => (s - 1) as Step)}
            disabled={pending}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (selectedIds.length === 0) {
                toast.error("Pick at least one partner");
                return;
              }
              setStep((s) => (s + 1) as Step);
            }}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            Send {selectedPartners.length} invitations
          </Button>
        )}
      </footer>
    </div>
  );
}
