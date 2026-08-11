"use client";

/**
 * Tag curation table.
 *
 * Four actions per row — promote, reject, move facet, merge. The merge and
 * move-facet controls are inline rather than in a modal because curation is a
 * batch activity: an operator works through twenty pending tags in one sitting,
 * and a dialog per decision would triple the clicks.
 */

import { useMemo, useState, useTransition } from "react";
import { Check, GitMerge, MoveRight, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  mergeTagsAction,
  promoteTagAction,
  refacetTagAction,
  rejectTagAction,
} from "@/lib/actions/admin-tags";
import type { AdminTag } from "../page";

type Filter = "pending" | "global" | "rejected" | "misfiled" | "all";

export function TagCurationTable({
  tags,
  facets,
}: {
  tags: AdminTag[];
  facets: string[];
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [term, setTerm] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    return tags.filter((t) => {
      if (filter === "misfiled" && !t.suggestedFacet) return false;
      if (filter !== "all" && filter !== "misfiled" && t.status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.facet.toLowerCase().includes(q)
      );
    });
  }, [tags, filter, term]);

  const run = (
    id: string,
    fn: () => Promise<{ ok: boolean; error?: { code: string; message?: string } }>,
    successMsg: string,
  ) => {
    setBusyId(id);
    startTransition(async () => {
      const result = await fn();
      setBusyId(null);
      if (result.ok) toast.success(successMsg);
      else {
        toast.error(
          result.error?.code === "INVALID_INPUT"
            ? (result.error.message ?? "That change was rejected")
            : "Could not apply that change",
        );
      }
    });
  };

  const counts = useMemo(
    () => ({
      pending: tags.filter((t) => t.status === "pending").length,
      global: tags.filter((t) => t.status === "global").length,
      rejected: tags.filter((t) => t.status === "rejected").length,
      misfiled: tags.filter((t) => t.suggestedFacet).length,
      all: tags.length,
    }),
    [tags],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["pending", "misfiled", "global", "rejected", "all"] as Filter[]).map(
            (f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11.5px] font-medium capitalize transition-colors",
                  filter === f
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-card text-muted-foreground hover:border-line-strong",
                )}
              >
                {f} ({counts[f]})
              </button>
            ),
          )}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by label, slug or facet"
            className="h-10 rounded-xl bg-white pl-9 text-[13px]"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="border-line bg-card shadow-none">
          <CardContent className="py-14 text-center text-[13px] text-muted-foreground">
            Nothing here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visible.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              facets={facets}
              allTags={tags}
              busy={busyId === tag.id}
              onPromote={() =>
                run(tag.id, () => promoteTagAction({ tagId: tag.id }), `Promoted "${tag.label}"`)
              }
              onReject={() =>
                run(tag.id, () => rejectTagAction({ tagId: tag.id }), `Rejected "${tag.label}"`)
              }
              onRefacet={(facet) =>
                run(
                  tag.id,
                  () => refacetTagAction({ tagId: tag.id, facet }),
                  `Moved "${tag.label}" to ${facet}`,
                )
              }
              onMerge={(targetId) =>
                run(
                  tag.id,
                  () => mergeTagsAction({ sourceId: tag.id, targetId }),
                  `Merged "${tag.label}"`,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TagRow({
  tag,
  facets,
  allTags,
  busy,
  onPromote,
  onReject,
  onRefacet,
  onMerge,
}: {
  tag: AdminTag;
  facets: string[];
  allTags: AdminTag[];
  busy: boolean;
  onPromote: () => void;
  onReject: () => void;
  onRefacet: (facet: string) => void;
  onMerge: (targetId: string) => void;
}) {
  const [mode, setMode] = useState<"none" | "merge" | "refacet">("none");

  // Merge targets must share the facet — the service layer enforces this too,
  // but offering impossible options would just produce error toasts.
  const mergeTargets = useMemo(
    () =>
      allTags
        .filter(
          (t) =>
            t.id !== tag.id && t.facet === tag.facet && t.status === "global",
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [allTags, tag],
  );

  return (
    <Card
      className={cn(
        "border-line shadow-none transition-opacity",
        tag.status === "rejected" && "opacity-60",
        busy && "opacity-50",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13.5px] font-semibold text-foreground">
                {tag.label}
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-line bg-surface-sunk text-[10px] font-medium text-muted-foreground"
              >
                {tag.facet}
              </Badge>
              <StatusBadge status={tag.status} />
              {tag.suggestedFacet && (
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-200 bg-amber-50 text-[10px] font-medium text-amber-700"
                >
                  {tag.suggestedIsDuplicate
                    ? `duplicated in ${tag.suggestedFacet}`
                    : `looks like ${tag.suggestedFacet}`}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="font-mono">{tag.slug}</span>
              <span>{tag.useCount} partner{tag.useCount === 1 ? "" : "s"}</span>
              {tag.status === "pending" && (
                <span>
                  suggested by {tag.suggestedByCount}
                </span>
              )}
              {tag.synonyms.length > 0 && (
                <span>synonyms: {tag.synonyms.join(", ")}</span>
              )}
              {tag.suggestedNear && (
                <span className="text-amber-700">
                  resembles &ldquo;{tag.suggestedNear}&rdquo;
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {/* One-click accept for the inferred facet. The generic "Move
                facet" picker stays available for everything else. */}
            {tag.suggestedFacet && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onRefacet(tag.suggestedFacet!)}
                className="h-9 border-amber-300 bg-amber-50 font-semibold text-amber-800 hover:bg-amber-100"
              >
                <MoveRight className="h-3.5 w-3.5" /> Move to {tag.suggestedFacet}
              </Button>
            )}
            {tag.status !== "global" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={onPromote}
                className="h-9 font-semibold"
              >
                <Check className="h-3.5 w-3.5" /> Promote
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setMode(mode === "refacet" ? "none" : "refacet")}
              className="h-9 bg-card font-semibold"
            >
              <MoveRight className="h-3.5 w-3.5" /> Move facet
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || mergeTargets.length === 0}
              onClick={() => setMode(mode === "merge" ? "none" : "merge")}
              className="h-9 bg-card font-semibold"
            >
              <GitMerge className="h-3.5 w-3.5" /> Merge
            </Button>
            {tag.status !== "rejected" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={onReject}
                className="h-9 text-muted-foreground hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
          </div>
        </div>

        {mode === "refacet" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              Move to:
            </span>
            {facets
              .filter((f) => f !== tag.facet)
              .map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onRefacet(f);
                    setMode("none");
                  }}
                  className="rounded-full border border-line bg-card px-3 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {f}
                </button>
              ))}
          </div>
        )}

        {mode === "merge" && (
          <div className="space-y-2 border-t border-line pt-3">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              Merge &ldquo;{tag.label}&rdquo; into (its spelling becomes a
              synonym):
            </span>
            <select
              disabled={busy}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                onMerge(e.target.value);
                setMode("none");
              }}
              className="h-10 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900"
            >
              <option value="">Choose the surviving tag…</option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.useCount} partners)
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "global"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-line bg-surface-sunk text-muted-foreground";
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full text-[10px] font-medium", cls)}
    >
      {status}
    </Badge>
  );
}
