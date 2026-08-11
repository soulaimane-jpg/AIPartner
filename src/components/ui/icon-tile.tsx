import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Signature icon wrapper — a rounded square with a brand tint, an inner
 * highlight, and a subtle shadow. Used on feature cards, section eyebrows,
 * and hero spotlights so the *icon look itself* becomes a brand element.
 *
 *   <IconTile size="lg" tone="amber"><Sparkles/></IconTile>
 */
const tileVariants = cva(
  [
    "inline-grid place-items-center shrink-0 rounded-xl",
    "shadow-[var(--elev-1)]",
    "ring-1 ring-inset",
    "transition-[transform,box-shadow] duration-240 ease-out-quart",
    "[&>svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-8 w-8 [&>svg]:size-4",
        md: "h-10 w-10 [&>svg]:size-5 rounded-[10px]",
        lg: "h-14 w-14 [&>svg]:size-7 rounded-2xl",
        xl: "h-20 w-20 [&>svg]:size-10 rounded-3xl",
      },
      tone: {
        // The signature look — amber gradient, indigo glow.
        amber: [
          "text-white",
          "bg-[linear-gradient(135deg,hsl(var(--amber-1))_0%,hsl(var(--amber-2))_100%)]",
          "ring-amber/40",
          "shadow-[var(--elev-amber)]",
          "[box-shadow:var(--elev-amber),inset_0_1px_0_hsl(0_0%_100%/0.55)]",
        ].join(" "),
        // Indigo, calmer tone for chrome
        indigo: [
          "text-white",
          "bg-[linear-gradient(135deg,hsl(var(--brand-1))_0%,hsl(var(--brand-2))_100%)]",
          "ring-white/15",
          "[box-shadow:var(--elev-2),inset_0_1px_0_hsl(0_0%_100%/0.35)]",
        ].join(" "),
        // Quietest — used for utility icons in cards
        muted: [
          "text-foreground",
          "bg-card ring-line",
        ].join(" "),
        // For cinema (dark) surfaces
        cinema: [
          "text-amber",
          "bg-card/60 ring-hairline",
          "backdrop-blur-md",
        ].join(" "),
      },
      interactive: {
        true:  "group-hover:-translate-y-px group-hover:shadow-elev-2",
        false: "",
      },
    },
    defaultVariants: { size: "md", tone: "amber", interactive: false },
  },
);

export interface IconTileProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tileVariants> {}

export function IconTile({
  className,
  size,
  tone,
  interactive,
  children,
  ...rest
}: IconTileProps) {
  return (
    <span
      className={cn(tileVariants({ size, tone, interactive }), className)}
      {...rest}
    >
      {children}
    </span>
  );
}
