"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const WORLDWIDE_LOCATIONS: string[] = [
  "Amsterdam, NL", "Athens, GR", "Atlanta, US", "Auckland, NZ", "Austin, US",
  "Baltimore, US", "Bangalore, IN", "Bangkok, TH", "Barcelona, ES", "Beijing, CN",
  "Berlin, DE", "Bogotá, CO", "Boston, US", "Brussels, BE", "Bucharest, RO",
  "Budapest, HU", "Buenos Aires, AR", "Cairo, EG", "Calgary, CA", "Cape Town, ZA",
  "Chicago, US", "Chennai, IN", "Copenhagen, DK", "Dallas, US", "Delhi, IN",
  "Denver, US", "Doha, QA", "Dubai, AE", "Dublin, IE", "Edinburgh, GB",
  "Frankfurt, DE", "Geneva, CH", "Hamburg, DE", "Helsinki, FI", "Ho Chi Minh City, VN",
  "Hong Kong, HK", "Houston, US", "Hyderabad, IN", "Istanbul, TR", "Jakarta, ID",
  "Johannesburg, ZA", "Kansas City, US", "Kuala Lumpur, MY", "Kyoto, JP",
  "Las Vegas, US", "Lisbon, PT", "London, GB", "Los Angeles, US", "Madrid, ES",
  "Manchester, GB", "Manila, PH", "Melbourne, AU", "Mexico City, MX", "Miami, US",
  "Milan, IT", "Minneapolis, US", "Montreal, CA", "Mumbai, IN", "Munich, DE",
  "Nairobi, KE", "Nashville, US", "New Delhi, IN", "New York, US", "Newcastle, GB",
  "Oslo, NO", "Ottawa, CA", "Paris, FR", "Perth, AU", "Philadelphia, US",
  "Phoenix, US", "Portland, US", "Prague, CZ", "Reykjavik, IS", "Riga, LV",
  "Rio de Janeiro, BR", "Rome, IT", "San Diego, US", "San Francisco, US",
  "Santiago, CL", "São Paulo, BR", "Seattle, US", "Seoul, KR", "Shanghai, CN",
  "Shenzhen, CN", "Singapore, SG", "Stockholm, SE", "Sydney, AU", "Taipei, TW",
  "Tel Aviv, IL", "Tokyo, JP", "Toronto, CA", "Vancouver, CA", "Vienna, AT",
  "Warsaw, PL", "Washington, US", "Zurich, CH",
];

export function LocationAutocomplete({
  id,
  name,
  defaultValue,
  placeholder = "Start typing a city…",
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [query, setQuery] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return WORLDWIDE_LOCATIONS.filter((loc) =>
      loc.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  React.useEffect(() => {
    setHighlighted(0);
  }, [filtered]);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        required={required}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && highlighted >= 0) {
            e.preventDefault();
            setQuery(filtered[highlighted]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="flex h-9 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-elev-3"
        >
          {filtered.map((loc, i) => (
            <li
              key={loc}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(loc);
                setOpen(false);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors",
                i === highlighted ? "bg-secondary" : "",
              )}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {loc}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
