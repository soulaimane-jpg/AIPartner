import { cn } from "@/lib/utils";

/**
 * Horizontal infinite marquee. Children should be a flat list of items;
 * we duplicate them so the CSS animation can loop seamlessly.
 *
 * Edges are softly faded with `mask-fade-edges` so items dissolve in/out
 * instead of popping at the viewport edge.
 *
 * Pauses on hover via group-hover (so a visitor can read a logo).
 */
export function MarqueeRow({
  children,
  speed = 38,
  className,
}: {
  children: React.ReactNode;
  /** Loop duration in seconds — bigger number = slower scroll. */
  speed?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group/marquee relative w-full overflow-hidden mask-fade-edges",
        className,
      )}
    >
      <div
        className="flex w-max animate-marquee-x"
        style={{
          animationDuration: `${speed}s`,
          animationPlayState: "running",
        }}
      >
        <div className="flex shrink-0 items-center gap-12 pr-12">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center gap-12 pr-12">
          {children}
        </div>
      </div>

      {/* Pause on hover */}
      <style>{`
        .group\\/marquee:hover .animate-marquee-x { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
