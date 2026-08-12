"use client";

/**
 * Partner ops dashboard table — sortable, filterable.
 *
 * Pure client component (sorting/filtering shouldn't hit the server).
 * Receives a precomputed list of `PartnerOpsRow` from the page.
 *
 * Columns are intentionally numeric — this is the "who deserves a
 * Premier upgrade" view, not a marketing dashboard.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatResponseMs,
  type PartnerOpsRow,
} from "@/lib/partner-ops-shared";

type SortKey =
  | "name"
  | "totalMatches"
  | "medianResponseMs"
  | "acceptRate"
  | "winRate"
  | "csat";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Partner", align: "left" },
  { key: "totalMatches", label: "Matches", align: "right" },
  { key: "medianResponseMs", label: "Median response", align: "right" },
  { key: "acceptRate", label: "Accept %", align: "right" },
  { key: "winRate", label: "Win %", align: "right" },
  { key: "csat", label: "CSAT", align: "right" },
];

export function PartnerOpsTable({ rows }: { rows: PartnerOpsRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "totalMatches",
    dir: "desc",
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.partnerName.toLowerCase().includes(q) ||
            (r.tier ?? "").toLowerCase().includes(q),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const sign = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "name":
          return sign * a.partnerName.localeCompare(b.partnerName);
        case "totalMatches":
          return sign * (a.totalMatches - b.totalMatches);
        case "medianResponseMs":
          return sign * compareNullable(a.medianResponseMs, b.medianResponseMs);
        case "acceptRate":
          return sign * compareNullable(a.acceptRate, b.acceptRate);
        case "winRate":
          return sign * compareNullable(a.winRate, b.winRate);
        case "csat":
          return sign * compareNullable(a.csat, b.csat);
      }
    });
  }, [rows, query, sort]);

  function setSortKey(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter partners…"
            className="pl-8"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {visible.length} shown · trailing 90d
        </span>
      </div>

      <div className="customer-table">
        <table className="w-full text-sm">
          <thead className="bg-card/60 border-b border-line">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 font-medium text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSortKey(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-foreground",
                      sort.key === col.key && "text-foreground",
                    )}
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No partners matched.
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.partnerId} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/partners/${r.partnerId}`}
                      className="font-medium hover:underline"
                    >
                      {r.partnerName}
                    </Link>
                    {r.tier && (
                      <Badge
                        tone="brand"
                        shape="soft"
                        size="sm"
                        uppercase
                        className="ml-2"
                      >
                        {r.tier}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.totalMatches}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatResponseMs(r.medianResponseMs)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.acceptRate == null ? "—" : `${Math.round(r.acceptRate * 100)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.winRate == null ? "—" : `${Math.round(r.winRate * 100)}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.csat == null ? "—" : r.csat.toFixed(1)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareNullable(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a - b;
}
