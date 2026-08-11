import { cn } from "@/lib/utils";

/**
 * Decorative SVG curves used as background accents on the hero and CTA
 * band — pure visual filler, no semantic meaning. Renders an interlocking
 * triple-arc swirl in the top-right corner that echoes the brand mark.
 *
 * Pass `tone="light"` for use against the dark cinema header / hero
 * gradient, or `tone="dark"` for the (rarer) inverse case.
 */
export function CurveAccents({
  className,
  tone = "light",
  size = 720,
  opacity = 0.18,
}: {
  className?: string;
  tone?: "light" | "dark";
  size?: number;
  opacity?: number;
}) {
  const stroke = tone === "light" ? "white" : "hsl(var(--cinema-bg))";
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 800"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("pointer-events-none select-none", className)}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="curve-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={stroke} stopOpacity="0" />
          <stop offset="50%"  stopColor={stroke} stopOpacity="1" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Outer arc */}
      <path
        d="M -100 700 Q 200 200 700 -100"
        stroke="url(#curve-stroke)"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Middle arc */}
      <path
        d="M -50 750 Q 280 320 800 30"
        stroke="url(#curve-stroke)"
        strokeWidth="1.2"
        fill="none"
      />
      {/* Inner arc */}
      <path
        d="M 0 800 Q 360 440 880 160"
        stroke="url(#curve-stroke)"
        strokeWidth="1"
        fill="none"
      />
      {/* Distant arc */}
      <path
        d="M -200 600 Q 100 100 600 -200"
        stroke="url(#curve-stroke)"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}
