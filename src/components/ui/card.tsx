import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "relative rounded-xl text-card-foreground transition-[box-shadow,border-color,transform] duration-160 ease-out-quart",
  {
    variants: {
      variant: {
        // Borderless on hairline ring; cleanest and quietest.
        flat:    "bg-card border border-line",
        // Default cards in the app — line + soft elev-1.
        raised:  "bg-card border border-line shadow-elev-1",
        // Cinema / on top of mesh backgrounds.
        glass:   "bg-card/70 border border-line/70 backdrop-blur-md backdrop-saturate-150",
        // Inset (nested) — sunk surface, no shadow.
        inset:   "bg-surface-sunk border border-line",
      },
      interactive: {
        true:  "hover:border-line-strong hover:shadow-elev-2 hover:-translate-y-px",
        false: "",
      },
      padding: {
        none: "",
        sm:   "p-4",
        md:   "p-5",
        lg:   "p-6",
      },
    },
    defaultVariants: {
      variant: "raised",
      interactive: false,
      padding: "none",
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** CSS 3-D tilt on hover (decorative; marketing only). */
  tilt?: boolean;
  asChild?: never;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, padding, tilt = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, interactive, padding }),
        tilt &&
          "preserve-3d hover:[transform:perspective(900px)_rotateX(1.4deg)_rotateY(-2.4deg)_translateY(-2px)] hover:shadow-elev-3 transition-transform duration-280",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-[15.5px] font-semibold leading-none tracking-[-0.012em] text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[13.5px] leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-5 pt-0 sm:p-6 sm:pt-0",
      "[&>:not(:last-child)]:flex-1",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { cardVariants };
