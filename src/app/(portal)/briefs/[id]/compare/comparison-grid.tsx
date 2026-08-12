"use client";

/**
 * M10 — anonymized comparison grid + voting + selection + reveal.
 * Rows are canonical proposal sections; columns are "Partner A/B/C"
 * placeholders until the reveal event, when selected columns show
 * real names.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Eye,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  castProposalVoteAction,
  selectPartnersAction,
  approveRevealAction,
} from "@/lib/actions/selection";
import { AskPartnerQuestion } from "@/components/brief/ask-partner-question";
import { mapErrorToToast } from "@/lib/schemas/errors";
import { cn } from "@/lib/utils";

export interface ComparisonColumnDTO {
  matchId: string;
  placeholderLabel: string;
  submissionRank: number;
  matchStatus: string;
  revealedName: string | null;
  cells: Record<string, { summary: string; detail: string | null }>;
  votes: {
    voter: string;
    mine: boolean;
    value: "yes" | "no";
    comment: string | null;
  }[];
}

export function ComparisonGrid({
  briefId,
  leadState,
  selectionDeadlineAt,
  sectionRows,
  columns,
}: {
  briefId: string;
  leadState: string;
  selectionDeadlineAt: string | null;
  sectionRows: { key: string; label: string }[];
  columns: ComparisonColumnDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const selecting = leadState === "COMPARISON_RELEASED";
  const awaitingReveal = leadState === "COMPANY_SELECTED";
  const revealed = ["REVEAL_APPROVED", "MEETINGS_SCHEDULED", "COMPLETED"].includes(
    leadState,
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: unknown }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(mapErrorToToast(result.error as never));
    });
  };

  const toggleSelect = (matchId: string) =>
    setSelected((prev) =>
      prev.includes(matchId)
        ? prev.filter((id) => id !== matchId)
        : prev.length < 3
          ? [...prev, matchId]
          : prev,
    );

  const deadline = selectionDeadlineAt ? new Date(selectionDeadlineAt) : null;

  return (
    <div className="space-y-5">
      {selecting && deadline && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-[13px] text-amber-800">
          <Clock className="h-4 w-4" />
          Select up to 3 partners by {deadline.toLocaleString()}.
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-elev-1">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              <th className="text-left px-4 py-3 text-[10.5px] uppercase tracking-[0.12em] font-semibold text-muted-foreground sticky left-0 bg-secondary/40 z-10 w-[150px]">
                Section
              </th>
              {columns.map((col) => (
                <th
                  key={col.matchId}
                  className="text-left px-4 py-3 min-w-[240px] border-l border-border align-bottom"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-foreground">
                      {col.revealedName ?? col.placeholderLabel}
                    </span>
                    {col.submissionRank === 1 && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        Submitted first
                      </Badge>
                    )}
                    {col.matchStatus === "SELECTED" && (
                      <Badge variant="success" className="text-[10px] uppercase tracking-wider">
                        <Trophy className="h-2.5 w-2.5" /> Selected
                      </Badge>
                    )}
                  </div>
                  {selecting && col.matchStatus === "QC_PASSED" && (
                    <label className="mt-1.5 flex items-center gap-1.5 text-[12px] font-normal text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.includes(col.matchId)}
                        onChange={() => toggleSelect(col.matchId)}
                        className="h-3.5 w-3.5"
                      />
                      Shortlist for meetings
                    </label>
                  )}
                  {/* Ask before you commit — anonymity is preserved on
                      both sides, so this doesn't force an early reveal. */}
                  {selecting && (
                    <div className="mt-1.5 font-normal">
                      <AskPartnerQuestion
                        briefId={briefId}
                        matchId={col.matchId}
                        partnerLabel={col.revealedName ?? col.placeholderLabel}
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sectionRows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="px-4 py-3 align-top text-left sticky left-0 bg-background z-10 border-r border-border"
                >
                  <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground">
                    {row.label}
                  </span>
                </th>
                {columns.map((col) => {
                  const cell = col.cells[row.key];
                  const cellId = `${col.matchId}:${row.key}`;
                  return (
                    <td
                      key={cellId}
                      className="px-4 py-3 align-top border-l border-border"
                    >
                      {cell ? (
                        <div>
                          <p className="text-[12.5px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
                            {expanded === cellId
                              ? (cell.detail ?? cell.summary)
                              : cell.summary}
                          </p>
                          {cell.detail && cell.detail !== cell.summary && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded(expanded === cellId ? null : cellId)
                              }
                              className="mt-1 text-[11.5px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                            >
                              {expanded === cellId ? "Collapse" : "Read full"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[12px]">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Voting row */}
            <tr className="bg-secondary/20">
              <th
                scope="row"
                className="px-4 py-3 text-left sticky left-0 bg-secondary/20 z-10 border-r border-border"
              >
                <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground">
                  Team votes
                </span>
              </th>
              {columns.map((col) => {
                const myVote = col.votes.find((v) => v.mine)?.value ?? null;
                const yes = col.votes.filter((v) => v.value === "yes").length;
                const no = col.votes.filter((v) => v.value === "no").length;
                return (
                  <td
                    key={col.matchId}
                    className="px-4 py-3 border-l border-border"
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        variant={myVote === "yes" ? "default" : "outline"}
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            castProposalVoteAction({
                              briefId,
                              matchId: col.matchId,
                              value: "yes",
                            }),
                          )
                        }
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {yes}
                      </Button>
                      <Button
                        variant={myVote === "no" ? "default" : "outline"}
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            castProposalVoteAction({
                              briefId,
                              matchId: col.matchId,
                              value: "no",
                            }),
                          )
                        }
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> {no}
                      </Button>
                    </div>
                    {col.votes.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {col.votes.map((v) => v.voter).join(", ")}
                      </p>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {selecting && (
        <div className="rounded-lg border border-border bg-background p-5 flex flex-wrap items-center gap-4">
          <p className="text-[13px] text-muted-foreground flex-1 min-w-[240px]">
            Select 1–3 partners to meet. Identities stay hidden until you
            approve the reveal in the next step.
          </p>
          <Button
            disabled={pending || selected.length === 0}
            onClick={() =>
              run(() => selectPartnersAction({ briefId, matchIds: selected }))
            }
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trophy className="h-4 w-4" />
            )}
            Confirm selection ({selected.length}/3)
          </Button>
        </div>
      )}

      {awaitingReveal && (
        <div className="rounded-lg border border-border bg-background p-5 space-y-3">
          <h2 className="text-[14px] font-semibold text-foreground">
            Ready to meet your selected partners?
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Approving the reveal shares your company identity with the
            selected partners and shows you who they are — then intro
            meetings get scheduled. Partners you didn&apos;t select are
            respectfully declined and never learn your identity.
          </p>
          <Button
            disabled={pending}
            onClick={() => run(() => approveRevealAction({ briefId }))}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Approve mutual reveal
          </Button>
        </div>
      )}

      {revealed && (
        <div className={cn("rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800")}>
          Identities revealed for your selected partners — intro meetings are
          being scheduled.
        </div>
      )}
    </div>
  );
}
