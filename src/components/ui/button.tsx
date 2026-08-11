import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/btn relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none",
    "rounded-md text-[13.5px] font-medium tracking-[-0.005em]",
    "transition-[transform,background-color,box-shadow,border-color,color] duration-160 ease-out-quart",
    "active:scale-[0.985]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Solid neutral primary — uses indigo brand-1
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[var(--elev-1),var(--inner-highlight)]",
          "hover:bg-[hsl(var(--brand-1)/0.92)] hover:shadow-elev-2",
        ].join(" "),
        // Signature gradient — indigo → amber (the brand's "lit" CTA)
        gradient: [
          "text-white",
          "bg-[linear-gradient(120deg,hsl(var(--brand-1))_0%,hsl(var(--brand-2))_55%,hsl(var(--amber-1))_100%)]",
          "bg-[length:220%_100%] bg-left",
          "shadow-[var(--elev-brand),var(--inner-highlight)]",
          "hover:bg-right hover:shadow-[var(--elev-brand),var(--inner-highlight),0_0_0_4px_hsl(var(--amber-1)/0.18)]",
          "transition-[background-position,box-shadow] duration-600 ease-out-expo",
        ].join(" "),
        // Pure magenta gradient — back-compat alias kept under "amber" name
        // for existing callsites; visually identical to "pill-magenta".
        amber: [
          "text-white",
          "bg-[linear-gradient(120deg,hsl(var(--magenta-2))_0%,hsl(var(--magenta-1))_100%)]",
          "bg-[length:200%_100%] bg-left",
          "shadow-[0_8px_24px_-8px_hsl(var(--magenta-1)/0.55),inset_0_1px_0_hsl(0_0%_100%/0.4)]",
          "hover:bg-right hover:shadow-[0_8px_24px_-8px_hsl(var(--magenta-1)/0.7),inset_0_1px_0_hsl(0_0%_100%/0.4),0_0_0_4px_hsl(var(--magenta-1)/0.20)]",
          "transition-[background-position,box-shadow] duration-600 ease-out-expo",
        ].join(" "),

        /* ── Salsify-style pill variants (uppercase + tracked) ── */
        // Black-fill pill — primary CTA on light or gradient backgrounds
        "pill-dark": [
          "rounded-full uppercase tracking-[0.06em] font-semibold",
          "bg-[hsl(var(--cinema-bg))] text-white",
          "shadow-[0_2px_4px_hsl(var(--cinema-bg)/0.25),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
          "hover:bg-[hsl(266_40%_12%)]",
          "hover:shadow-[0_8px_20px_-6px_hsl(var(--cinema-bg)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.08)]",
        ].join(" "),
        // Magenta gradient pill — the top-bar CTA
        "pill-magenta": [
          "rounded-full uppercase tracking-[0.06em] font-semibold",
          "text-white",
          "bg-[linear-gradient(120deg,hsl(var(--magenta-2))_0%,hsl(var(--magenta-1))_100%)]",
          "bg-[length:200%_100%] bg-left",
          "shadow-[0_4px_14px_-3px_hsl(var(--magenta-1)/0.55),inset_0_1px_0_hsl(0_0%_100%/0.35)]",
          "hover:bg-right",
          "hover:shadow-[0_10px_28px_-6px_hsl(var(--magenta-1)/0.75),inset_0_1px_0_hsl(0_0%_100%/0.35),0_0_0_4px_hsl(var(--magenta-1)/0.18)]",
          "transition-[background-position,box-shadow] duration-600 ease-out-expo",
        ].join(" "),
        // White-outlined pill — secondary on the gradient hero
        "pill-outline-light": [
          "rounded-full uppercase tracking-[0.06em] font-semibold",
          "text-white border-[1.5px] border-white/85 bg-transparent",
          "hover:bg-white/10 hover:border-white",
        ].join(" "),
        // Outlined pill on light backgrounds (for cards, secondary CTAs)
        "pill-outline-dark": [
          "rounded-full uppercase tracking-[0.06em] font-semibold",
          "text-foreground border-[1.5px] border-line-strong bg-transparent",
          "hover:bg-secondary hover:border-foreground",
        ].join(" "),
        // Outline — pristine card surface, line border
        outline: [
          "bg-card text-foreground border border-line",
          "shadow-elev-1",
          "hover:border-line-strong hover:bg-surface-2 hover:shadow-elev-2",
        ].join(" "),
        // Glass — used on cinema surfaces (dark hero sections)
        glass: [
          "text-foreground border border-white/10",
          "bg-white/5 backdrop-blur-md",
          "shadow-[0_0_0_1px_hsl(0_0%_100%/0.08)_inset]",
          "hover:bg-white/10 hover:border-white/20",
        ].join(" "),
        // Ghost — quietest, table actions
        ghost:
          "text-foreground/85 hover:text-foreground hover:bg-secondary",
        // Secondary — soft fill chip
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[hsl(var(--secondary)/0.7)]",
        // Destructive
        destructive: [
          "bg-danger text-danger-foreground",
          "shadow-[var(--elev-1),var(--inner-highlight)]",
          "hover:bg-[hsl(var(--danger)/0.92)] hover:shadow-elev-2",
        ].join(" "),
        // Inline link
        link:
          "text-brand-1 underline-offset-[3px] hover:underline px-0 h-auto",
      },
      size: {
        xs:  "h-7 px-2.5 text-[12px] rounded-sm gap-1",
        sm:  "h-8 px-3   text-[13px] rounded-md",
        md:  "h-9 px-4   rounded-md",
        // legacy alias of md (will be deprecated in phase 4)
        default: "h-9 px-4 rounded-md",
        lg:  "h-10 px-5  text-[14px] rounded-lg",
        xl:  "h-12 px-6  text-[15px] rounded-lg gap-2",
        "icon-sm": "h-7 w-7 rounded-sm [&_svg]:size-3.5",
        icon: "h-9 w-9 rounded-md",
        "icon-lg": "h-10 w-10 rounded-lg [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
    compoundVariants: [
      { variant: "link", size: "md", class: "h-auto px-0" },
      { variant: "link", size: "sm", class: "h-auto px-0" },
    ],
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Show a spinner and disable the button. */
  loading?: boolean;
  /** Icon left of the label. Pass a lucide-react component. */
  leftIcon?: React.ReactNode;
  /** Icon right of the label. */
  rightIcon?: React.ReactNode;
  /** Optional kbd hint pinned to the right edge (e.g. "⌘K"). */
  shortcut?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      shortcut,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // When asChild we cannot inject extra elements; fall back to children only.
    // For the regular path: render children as direct flex items (do NOT wrap
    // them in a <span>, otherwise inline <svg>s passed inside children get
    // `display: block` from Tailwind preflight and stack above the label).
    const content = asChild ? (
      children
    ) : (
      <>
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
        {shortcut && (
          <kbd className="ml-1.5 -mr-1 text-[10.5px] tracking-tight bg-transparent border-current/20 text-current/60">
            {shortcut}
          </kbd>
        )}
      </>
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={disabled || loading || undefined}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

/**
 * Square icon button — sized helper for `<Button variant="ghost" size="icon">`
 * with sensible defaults for chrome (toolbar icons, sidebar collapse, etc.).
 */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "size"> & { size?: "sm" | "md" | "lg" }
>(({ size = "md", variant = "ghost", className, ...props }, ref) => {
  const mapped =
    size === "sm" ? "icon-sm" : size === "lg" ? "icon-lg" : "icon";
  return (
    <Button
      ref={ref}
      variant={variant}
      size={mapped as ButtonProps["size"]}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      {...props}
    />
  );
});
IconButton.displayName = "IconButton";

export { buttonVariants };
