import { redirect } from "next/navigation";
import { AlertTriangle, Tags } from "lucide-react";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import type { TagRow } from "@/lib/db/rows";
import { Card, CardContent } from "@/components/ui/card";
import { TAG_FACETS } from "@/lib/partner-pillars";
import { PROMOTION_THRESHOLD } from "@/lib/tags";
import { TagCurationTable } from "./_components/tag-curation-table";
import { findMisfiledTags } from "@/lib/tag-misfile";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export interface AdminTag {
  id: string;
  slug: string;
  label: string;
  facet: string;
  status: string;
  synonyms: string[];
  useCount: number;
  suggestedByCount: number;
  /**
   * Facet this tag probably belongs in, inferred from label-token overlap with
   * tags in other facets. See `lib/tag-misfile.ts`.
   */
  suggestedFacet: string | null;
  /** Closest tag in that facet, shown so the admin can sanity-check. */
  suggestedNear: string | null;
  /** The same concept already exists in `suggestedFacet` — merge, don't move. */
  suggestedIsDuplicate: boolean;
}

export default async function AdminTagsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const rows = await query<TagRow>(
    `SELECT * FROM "Tag"
     WHERE "mergedIntoId" IS NULL
     ORDER BY
       "status" = 'pending' DESC,
       "suggestedByCount" DESC,
       "useCount" DESC,
       "label" ASC`,
  );

  // Misfile detection runs in memory rather than SQL: it compares label tokens,
  // which is impractical to express as a query and trivial over a catalogue
  // this small.
  const suggestions = findMisfiledTags(
    rows.map((r) => ({
      id: r.id,
      label: r.label,
      facet: r.facet,
      status: r.status,
    })),
  );

  const tags: AdminTag[] = rows.map((r) => {
    const suggestion = suggestions.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      label: r.label,
      facet: r.facet,
      status: r.status,
      synonyms: safeJsonParse<string[]>(r.synonyms, []),
      useCount: r.useCount,
      suggestedByCount: r.suggestedByCount,
      suggestedFacet: suggestion?.facet ?? null,
      suggestedNear: suggestion?.nearestLabel ?? null,
      suggestedIsDuplicate: suggestion?.isDuplicate ?? false,
    };
  });

  const pending = tags.filter((t) => t.status === "pending");
  const readyToPromote = pending.filter(
    (t) => t.suggestedByCount >= PROMOTION_THRESHOLD,
  );
  const misfiled = tags.filter((t) => t.suggestedFacet);

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          Tag library
        </span>
        <h1 className="portal-page-title">
          Curate the partner vocabulary
        </h1>
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Every tag partners can pick lives here. Promoting a suggestion makes it
          canonical for everyone; merging captures the old spelling as a synonym
          so existing profiles keep resolving.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total tags" value={tags.length} icon={<Tags className="h-4 w-4" />} />
        <StatCard label="Awaiting review" value={pending.length} tone="amber" />
        <StatCard
          label={`Suggested by ${PROMOTION_THRESHOLD}+ partners`}
          value={readyToPromote.length}
          tone="emerald"
        />
      </div>

      {misfiled.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <h2 className="text-[13.5px] font-semibold text-amber-950">
                {misfiled.length} tag{misfiled.length === 1 ? "" : "s"} look
                misfiled
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">
                Their labels closely match tags in a different facet. The old
                importer dumped unmatched verticals and workloads into
                &ldquo;products&rdquo;, so most of these want{" "}
                <strong>Move facet</strong> or <strong>Merge</strong> rather than
                promotion. Each suggestion shows the tag it resembles — check it
                before applying.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <TagCurationTable tags={tags} facets={[...TAG_FACETS]} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "default" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "amber"
      ? "text-amber-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : "text-foreground";
  return (
    <Card className="border-line bg-card shadow-elev-1">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-[11.5px] font-medium text-muted-foreground">
            {label}
          </div>
          <div className={`mt-1 text-[22px] font-semibold tabular-nums ${toneCls}`}>
            {value}
          </div>
        </div>
        {icon && (
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-sunk text-muted-foreground">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
