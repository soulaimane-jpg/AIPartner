"use client";

/**
 * Async multi-select over one tag facet, with a "+ Suggest" escape hatch.
 *
 * Design constraints, all from the intake feedback:
 *   - **Capped.** `max` is enforced here and again server-side. Without a cap
 *     every partner ticks every box and the data stops discriminating.
 *   - **Never blocks.** A suggested tag is usable the instant it is created;
 *     admin promotion happens later. Partners are not left waiting.
 *   - **Cheap to scan.** Results show the canonical label plus a "new" marker
 *     for pending tags, so partners prefer the blessed vocabulary by default.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { suggestPartnerTagAction } from "@/lib/actions/partner-pillars";

export interface TagOption {
  id: string;
  label: string;
  status?: string;
  useCount?: number;
}

export function TagPicker({
  facet,
  value,
  onChange,
  max,
  placeholder = "Search…",
  /** Labels for ids already selected, so chips render before any search. */
  initialLabels = {},
  disabled,
}: {
  facet: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  initialLabels?: Record<string, string>;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>(initialLabels);
  const boxRef = useRef<HTMLDivElement>(null);

  const atMax = max !== undefined && value.length >= max;

  // Keep the label cache authoritative for anything the parent hands us.
  useEffect(() => {
    setLabels((prev) => ({ ...initialLabels, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialLabels)]);

  // Backfill labels for ids we have never seen (e.g. after an import).
  useEffect(() => {
    const unknown = value.filter((id) => !labels[id]);
    if (unknown.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/partner/tags?ids=${encodeURIComponent(unknown.join(","))}`,
        );
        const json = await res.json();
        if (cancelled || !json.ok) return;
        setLabels((prev) => {
          const next = { ...prev };
          for (const t of json.tags as TagOption[]) next[t.id] = t.label;
          return next;
        });
      } catch {
        // Chips fall back to a truncated id; not worth surfacing an error.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.join(","), labels]);

  // Debounced search. 180ms is below the threshold where typing feels laggy
  // but high enough to avoid a request per keystroke.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/partner/tags?facet=${encodeURIComponent(facet)}&q=${encodeURIComponent(term)}`,
        );
        const json = await res.json();
        if (!cancelled && json.ok) {
          setResults(json.tags as TagOption[]);
          setLabels((prev) => {
            const next = { ...prev };
            for (const t of json.tags as TagOption[]) next[t.id] = t.label;
            return next;
          });
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, facet, open]);

  // Close on outside click so the panel doesn't trap the page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = useCallback(
    (id: string) => {
      if (value.includes(id)) {
        onChange(value.filter((v) => v !== id));
        return;
      }
      if (max !== undefined && value.length >= max) {
        toast.error(`You can pick at most ${max} here.`);
        return;
      }
      onChange([...value, id]);
    },
    [value, onChange, max],
  );

  const exactExists = useMemo(
    () =>
      results.some(
        (r) => r.label.trim().toLowerCase() === term.trim().toLowerCase(),
      ),
    [results, term],
  );

  const suggest = async () => {
    const label = term.trim();
    if (!label) return;
    setSuggesting(true);
    try {
      const result = await suggestPartnerTagAction({ facet, label });
      if (!result.ok) {
        toast.error(
          result.error.code === "INVALID_INPUT"
            ? (result.error.issues[0]?.message ?? "Could not add that tag")
            : "Could not add that tag",
        );
        return;
      }
      const tag = result.data.tag;
      setLabels((prev) => ({ ...prev, [tag.id]: tag.label }));
      if (!value.includes(tag.id)) {
        if (max !== undefined && value.length >= max) {
          toast.error(`You can pick at most ${max} here.`);
        } else {
          onChange([...value, tag.id]);
        }
      }
      setTerm("");
      toast.success(`Added "${tag.label}"`);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div ref={boxRef} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <Badge
            key={id}
            variant="outline"
            className="gap-1.5 rounded-full border-primary/25 bg-primary/10 py-1 pl-3 pr-1.5 text-[12px] font-medium text-primary"
          >
            {labels[id] ?? `${id.slice(0, 8)}…`}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${labels[id] ?? "tag"}`}
                onClick={() => onChange(value.filter((v) => v !== id))}
                className="grid h-4 w-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {value.length === 0 && (
          <span className="text-[12px] text-muted-foreground">
            Nothing selected yet.
          </span>
        )}
      </div>

      {!disabled && (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={atMax ? `Limit of ${max} reached` : placeholder}
              disabled={atMax && !term}
              className="h-11 rounded-xl bg-card pl-9 text-[13px]"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {open && (
            <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-elev-2">
              {results.map((r) => {
                const selected = value.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {r.label}
                      {r.status === "pending" && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          new
                        </span>
                      )}
                    </span>
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}

              {!loading && results.length === 0 && (
                <div className="px-3 py-3 text-[12.5px] text-muted-foreground">
                  No matches in the library.
                </div>
              )}

              {/* Suggestion is only offered when nothing matches exactly, so
                  partners are nudged toward the canonical vocabulary first. */}
              {term.trim().length >= 2 && !exactExists && (
                <div className="mt-1 border-t border-line pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={suggesting}
                    onClick={suggest}
                    className="w-full justify-start text-[12.5px] font-medium"
                  >
                    {suggesting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Suggest &ldquo;{term.trim()}&rdquo;
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {max !== undefined && (
        <p className="text-[11.5px] text-muted-foreground">
          {value.length} of {max} selected.
        </p>
      )}
    </div>
  );
}
