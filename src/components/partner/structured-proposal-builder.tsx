"use client";

/**
 * M7 — structured proposal builder. One editor per canonical section
 * (§6.7), structured pricing with model options, explicit internal
 * approval, then submission (locks the proposal for QC).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  Send,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PROPOSAL_SECTION_KEYS,
  PROPOSAL_SECTIONS,
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
  type ProposalSectionKey,
  type PricingModel,
} from "@/lib/sections";
import {
  savePartnerProposalSectionAction,
  submitStructuredProposalAction,
} from "@/lib/actions/proposal-builder";
import { mapErrorToToast } from "@/lib/schemas/errors";

interface PricingOption {
  label: string;
  amountCents?: number;
  unit?: string;
  notes?: string;
}

interface SectionState {
  content: string;
  pricingModel: PricingModel;
  pricingOptions: PricingOption[];
}

export function StructuredProposalBuilder({
  matchId,
  briefId,
  proposalStatus,
  initialSections,
}: {
  matchId: string;
  briefId: string;
  proposalStatus: string;
  initialSections: Record<
    string,
    { content: string; pricing: { model: PricingModel; options: PricingOption[] } | null }
  >;
}) {
  const router = useRouter();
  const [sections, setSections] = React.useState<Record<string, SectionState>>(
    () => {
      const out: Record<string, SectionState> = {};
      for (const key of PROPOSAL_SECTION_KEYS) {
        const initial = initialSections[key];
        out[key] = {
          content: initial?.content ?? "",
          pricingModel: initial?.pricing?.model ?? "fixed",
          pricingOptions: initial?.pricing?.options ?? [{ label: "Total" }],
        };
      }
      return out;
    },
  );
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const editable =
    proposalStatus === "DRAFT" || proposalStatus === "CLARIFICATION_NEEDED";
  const canSubmit = proposalStatus === "DRAFT" || proposalStatus === "INTERNALLY_APPROVED";

  const save = async (key: ProposalSectionKey) => {
    const s = sections[key];
    setSavingKey(key);
    setError(null);
    const result = await savePartnerProposalSectionAction({
      matchId,
      briefId,
      key,
      content: s.content,
      ...(key === "pricing"
        ? {
            pricing: {
              model: s.pricingModel,
              options: s.pricingOptions.filter((o) => o.label),
            },
          }
        : {}),
    });
    setSavingKey(null);
    if (!result.ok) setError(mapErrorToToast(result.error));
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitStructuredProposalAction({ matchId, briefId });
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error));
    });
  };

  const patch = (key: string, patchObj: Partial<SectionState>) =>
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], ...patchObj } }));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">
          Structured proposal
        </h2>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
          {proposalStatus}
        </Badge>
        {!editable && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </header>

      {PROPOSAL_SECTION_KEYS.map((key) => {
        const meta = PROPOSAL_SECTIONS[key];
        const s = sections[key];
        return (
          <section
            key={key}
            className="overflow-hidden rounded-lg border border-border bg-surface-sunk"
          >
            <header className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-foreground">
                {meta.label}
              </h3>
              {meta.mandatory && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  required
                </span>
              )}
            </header>
            <div className="p-4 space-y-3">
              <p className="text-[11.5px] text-muted-foreground">{meta.hint}</p>

              {key === "pricing" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRICING_MODELS.map((model) => (
                      <button
                        key={model}
                        type="button"
                        disabled={!editable}
                        onClick={() => patch(key, { pricingModel: model })}
                        className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors ${
                          s.pricingModel === model
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        {PRICING_MODEL_LABELS[model]}
                      </button>
                    ))}
                  </div>
                  {s.pricingOptions.map((opt, i) => (
                    <div key={i} className="grid grid-cols-[1fr_140px_100px] gap-2">
                      <input
                        type="text"
                        value={opt.label}
                        disabled={!editable}
                        placeholder="Line item / tier"
                        onChange={(e) =>
                          patch(key, {
                            pricingOptions: s.pricingOptions.map((o, j) =>
                              j === i ? { ...o, label: e.target.value } : o,
                            ),
                          })
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={0}
                        value={
                          opt.amountCents != null ? opt.amountCents / 100 : ""
                        }
                        disabled={!editable}
                        placeholder="Amount (€)"
                        onChange={(e) =>
                          patch(key, {
                            pricingOptions: s.pricingOptions.map((o, j) =>
                              j === i
                                ? {
                                    ...o,
                                    amountCents: e.target.value
                                      ? Math.round(Number(e.target.value) * 100)
                                      : undefined,
                                  }
                                : o,
                            ),
                          })
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={opt.unit ?? ""}
                        disabled={!editable}
                        placeholder="unit"
                        onChange={(e) =>
                          patch(key, {
                            pricingOptions: s.pricingOptions.map((o, j) =>
                              j === i ? { ...o, unit: e.target.value } : o,
                            ),
                          })
                        }
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                  {editable && s.pricingOptions.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        patch(key, {
                          pricingOptions: [...s.pricingOptions, { label: "" }],
                        })
                      }
                      className="text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      + add line
                    </button>
                  )}
                </div>
              )}

              <textarea
                value={s.content}
                disabled={!editable}
                onChange={(e) => patch(key, { content: e.target.value })}
                rows={key === "pricing" ? 2 : 5}
                placeholder={
                  key === "pricing"
                    ? "Pricing notes / assumptions behind the numbers"
                    : meta.mandatory
                      ? "Required before submission"
                      : "Optional"
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              {editable && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingKey === key}
                    onClick={() => save(key)}
                  >
                    {savingKey === key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-border bg-surface-sunk p-5">
        {canSubmit && (
          <>
            <p className="text-[12.5px] text-muted-foreground">
              Submitting locks the proposal and sends it to the AIPartner team for review.
              The admin will either confirm it for the client, send back a note, or decline.
            </p>
            <Button onClick={submit} disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit proposal
            </Button>
          </>
        )}
        {!editable && !canSubmit && (
          <p className="text-[13px] text-muted-foreground">
            {proposalStatus === "SUBMITTED" || proposalStatus === "IN_QC"
              ? "Submitted — the AIPartner team is reviewing your proposal."
              : proposalStatus === "QC_PASSED"
                ? "QC passed — your proposal joins the customer's comparison."
                : `Status: ${proposalStatus}`}
          </p>
        )}
      </div>
    </div>
  );
}
