"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Three-state theme toggle: light / system / dark.
 * Segmented control that reads current theme from next-themes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const options: { value: string; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  // Render inert skeleton server-side to avoid theme flicker.
  const current = mounted ? theme ?? "system" : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative grid place-items-center h-6 w-6 rounded-full",
              "transition-colors duration-150 ease-out",
              active
                ? "bg-card text-foreground shadow-[var(--elev-1)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
