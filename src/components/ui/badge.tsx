import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Semantic Badge system.
 *
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="warning" shape="solid" size="sm">2 retries</Badge>
 *   <Badge tone="brand" shape="outline">Pro</Badge>
 *
 * Backwards-compat: the legacy `variant` prop is still accepted and mapped
 * onto the new `tone`/`shape` axes.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full font-medium tracking-[-0.005em]",
    "transition-colors duration-120 ease-out-quart",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      tone: {
        neutral: "",
        info:    "",
        success: "",
        warning: "",
        danger:  "",
        brand:   "",
      },
      shape: {
        soft:    "border",
        solid:   "border border-transparent",
        outline: "bg-transparent border",
      },
      size: {
        sm: "h-5 px-2 text-[10.5px]",
        md: "h-6 px-2.5 text-[11.5px]",
      },
      uppercase: { true: "uppercase tracking-[0.08em] font-semibold", false: "" },
    },
    compoundVariants: [
      // SOFT — tinted background + border, semantic foreground
      { tone: "neutral", shape: "soft",
        class: "bg-secondary border-line text-muted-foreground" },
      { tone: "info",    shape: "soft",
        class: "bg-info/10 border-info/25 text-info" },
      { tone: "success", shape: "soft",
        class: "bg-success/10 border-success/25 text-success" },
      { tone: "warning", shape: "soft",
        class: "bg-warning/10 border-warning/25 text-warning" },
      { tone: "danger",  shape: "soft",
        class: "bg-danger/10 border-danger/25 text-danger" },
      { tone: "brand",   shape: "soft",
        class: "bg-brand-1/10 border-brand-1/25 text-brand-1" },

      // SOLID — high-contrast pill
      { tone: "neutral", shape: "solid",
        class: "bg-foreground text-background" },
      { tone: "info",    shape: "solid", class: "bg-info text-info-foreground" },
      { tone: "success", shape: "solid", class: "bg-success text-success-foreground" },
      { tone: "warning", shape: "solid", class: "bg-warning text-warning-foreground" },
      { tone: "danger",  shape: "solid", class: "bg-danger text-danger-foreground" },
      { tone: "brand",   shape: "solid",
        class: "text-white bg-[linear-gradient(120deg,hsl(var(--brand-1))_0%,hsl(var(--brand-2))_100%)]" },

      // OUTLINE — line border + tinted text only
      { tone: "neutral", shape: "outline",
        class: "border-line text-muted-foreground" },
      { tone: "info",    shape: "outline", class: "border-info/35 text-info" },
      { tone: "success", shape: "outline", class: "border-success/35 text-success" },
      { tone: "warning", shape: "outline", class: "border-warning/35 text-warning" },
      { tone: "danger",  shape: "outline", class: "border-danger/35 text-danger" },
      { tone: "brand",   shape: "outline", class: "border-brand-1/40 text-brand-1" },
    ],
    defaultVariants: {
      tone: "neutral",
      shape: "soft",
      size: "md",
      uppercase: false,
    },
  },
);

/* ── Backwards-compatible legacy variants ──────────────────────────── */
type LegacyVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "muted"
  | "premium";

function legacyToProps(v?: LegacyVariant | null): {
  tone?: VariantProps<typeof badgeVariants>["tone"];
  shape?: VariantProps<typeof badgeVariants>["shape"];
  uppercase?: boolean;
  size?: VariantProps<typeof badgeVariants>["size"];
} {
  switch (v) {
    case "default":   return { tone: "neutral", shape: "solid"   };
    case "secondary": return { tone: "neutral", shape: "soft"    };
    case "outline":   return { tone: "neutral", shape: "outline" };
    case "success":   return { tone: "success", shape: "soft", uppercase: true, size: "sm" };
    case "warning":   return { tone: "warning", shape: "soft", uppercase: true, size: "sm" };
    case "info":      return { tone: "info",    shape: "soft", uppercase: true, size: "sm" };
    case "muted":     return { tone: "neutral", shape: "soft", uppercase: true, size: "sm" };
    case "premium":   return { tone: "brand",   shape: "solid"   };
    default:          return {};
  }
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof badgeVariants>, "uppercase"> {
  /** Backwards-compatible legacy variant name. Prefer `tone` + `shape`. */
  variant?: LegacyVariant;
  uppercase?: boolean;
}

export function Badge({
  className,
  tone,
  shape,
  size,
  uppercase,
  variant,
  ...props
}: BadgeProps) {
  const legacy = legacyToProps(variant);
  return (
    <div
      className={cn(
        badgeVariants({
          tone:      tone ?? legacy.tone,
          shape:     shape ?? legacy.shape,
          size:      size ?? legacy.size,
          uppercase: uppercase ?? legacy.uppercase,
        }),
        className,
      )}
      {...props}
    />
  );
}

export { badgeVariants };
