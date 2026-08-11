"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown right-aligned and included in the search index. */
  description?: string | null;
};

/**
 * Searchable single-select combobox built on Radix Popover + cmdk.
 *
 * Type to filter; click or press Enter to select. Works inside a Dialog
 * (both portal to the body). Match is a case-insensitive substring over
 * the option label + description.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled,
  id,
  className,
  contentClassName,
}: {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) ?? null;
  // role="combobox" requires aria-controls pointing at the popup it opens, so
  // screen readers can associate the trigger with the option list.
  const listboxId = `${React.useId()}-listbox`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn("truncate", !selected && "font-normal text-slate-400")}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] overflow-hidden p-0",
          contentClassName,
        )}
      >
        <Command
          loop
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
          className="flex flex-col"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <Command.Input
              autoFocus
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <Command.List id={listboxId} className="max-h-56 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-xs text-slate-500">
              {emptyText}
            </Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={`${o.label} ${o.description ?? ""} ${o.value}`}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-800 aria-selected:bg-slate-100"
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-indigo-600",
                    value === o.value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{o.label}</span>
                {o.description ? (
                  <span className="ml-auto truncate pl-2 text-xs text-slate-400">
                    {o.description}
                  </span>
                ) : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
