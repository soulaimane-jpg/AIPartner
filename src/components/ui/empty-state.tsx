import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const emptyVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      size: {
        sm: "px-6 py-10 gap-3",
        md: "px-8 py-14 gap-4",
        lg: "px-10 py-20 gap-5",
      },
      surface: {
        plain:    "",
        card:     "card-flat",
        dashed:   "rounded-xl border border-dashed border-line bg-surface-2/40",
      },
    },
    defaultVariants: { size: "md", surface: "card" },
  },
);

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyVariants> {
  /** Decoration: an icon, illustration, or any node. Sized by the component. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary CTA / actions row. */
  actions?: React.ReactNode;
}

/**
 * Used everywhere there's "nothing here yet" — empty lists, no search
 * results, drained inboxes. Composable: pass any decoration as `icon`.
 *
 *   <EmptyState
 *     icon={<Inbox/>}
 *     title="Your inbox is empty"
 *     description="When a partner sends you a brief it'll appear here."
 *     actions={<Button>Refresh</Button>}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  size,
  surface,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div className={cn(emptyVariants({ size, surface }), className)} {...rest}>
      {icon && (
        <div
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full border border-border bg-card text-muted-foreground",
            "[&_svg]:size-4 [&_svg]:stroke-[1.75]",
            size === "sm" ? "h-10 w-10" : size === "lg" ? "h-14 w-14 [&_svg]:size-5" : "h-12 w-12",
          )}
        >
          {icon}
        </div>
      )}
      <div className="space-y-2 max-w-md">
        <h3 className="font-display text-[20px] leading-[1.2] font-medium tracking-[-0.014em] text-foreground text-balance">
          {title}
        </h3>
        {description && (
          <p className="text-[13.5px] leading-[1.6] text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
