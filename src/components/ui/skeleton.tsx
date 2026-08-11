import { cn } from "@/lib/utils";

/**
 * Shimmer skeleton block.
 *
 * Use for any list/card placeholder while data is loading. Pairs with
 * Suspense fallbacks (Next.js loading.tsx files) and with React Query/SWR
 * loading states inside client components.
 *
 * The shimmer keyframe lives in globals.css and is shared with `.skeleton`,
 * so utility users and component users get the exact same animation.
 */
export function Skeleton({
  className,
  rounded = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}) {
  const radius = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];
  return <div className={cn("skeleton", radius, className)} {...props} />;
}
