import { cn } from "@/lib/utils";

/**
 * Decorative gradient mesh background.
 *
 * Pure-CSS radial gradients — zero JS, zero images, scales smoothly. Used
 * behind hero sections, auth screens, and as a subtle backdrop for empty
 * states. Pairs well with `canvas-grid` or `canvas-dots` overlay utilities.
 *
 * Variants:
 *   • soft    — extremely faint, OK behind text-heavy content
 *   • default — moderate, used on landing hero
 *   • bold    — saturated, used on the marketing CTA band only
 */
export function GradientMesh({
  variant = "default",
  className,
  children,
  withGrid = false,
  withDots = false,
}: {
  variant?: "soft" | "default" | "bold";
  className?: string;
  children?: React.ReactNode;
  withGrid?: boolean;
  withDots?: boolean;
}) {
  const variantClass =
    variant === "soft"
      ? "gradient-mesh-soft"
      : variant === "bold"
        ? "gradient-mesh"
        : "gradient-mesh-soft md:gradient-mesh";

  return (
    <div className={cn("relative isolate overflow-hidden", variantClass, className)}>
      {(withGrid || withDots) && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 opacity-50",
            withGrid && "canvas-grid",
            withDots && "canvas-dots",
            "[mask-image:radial-gradient(80%_80%_at_50%_30%,black,transparent_75%)]",
          )}
        />
      )}
      {children}
    </div>
  );
}
