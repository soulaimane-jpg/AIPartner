import Link from "next/link";
import { BRAND } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * AI Partner monogram — v4 brand mark.
 *
 *   • Three concentric arcs in deep indigo, slightly rotated so they
 *     read as orbital paths (a metaphor for matching customers ↔ partners).
 *   • A single amber accent dot at the focus point — the signature.
 *   • Cream/transparent background so the mark sits well on either the
 *     pristine cream canvas or the cinema dark canvas.
 *
 * The component is a pure SVG, no external assets. Sizes use a `size`
 * prop in pixels to keep visual rhythm tight.
 */
export function MarkLogo({
  className,
  size = 36,
  /** When true the indigo strokes use cream — for use on cinema/dark backgrounds. */
  inverse = false,
}: {
  className?: string;
  size?: number;
  inverse?: boolean;
}) {
  const stroke = inverse ? "hsl(36 30% 96%)" : "hsl(var(--brand-1))";
  const ghost  = inverse ? "hsl(36 30% 96% / 0.4)" : "hsl(var(--brand-1) / 0.35)";

  return (
    <span
      className={cn("relative inline-block align-middle", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block transition-transform duration-360 ease-out-quart group-hover/brand:rotate-[-6deg]"
      >
        {/* Outer arc — biggest orbit */}
        <path
          d="M5.5 31C7 18.5 17 9 30 9.5"
          stroke={ghost}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Middle arc */}
        <path
          d="M11 35.5C12 25 19.5 17 30 17"
          stroke={stroke}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Inner arc — tightest orbit, slightly thicker */}
        <path
          d="M17 38.5C18 30 23.5 24.5 31.5 24.5"
          stroke={stroke}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* Amber focus dot */}
        <g className="origin-center transition-transform duration-280 ease-out-quart group-hover/brand:scale-110">
          <circle
            cx="34"
            cy="14"
            r="3.5"
            fill="hsl(var(--amber-1))"
          />
          <circle
            cx="34"
            cy="14"
            r="3.5"
            fill="url(#amber-glow)"
            opacity="0.6"
          />
        </g>
        <defs>
          <radialGradient id="amber-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(var(--amber-glow))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--amber-1))"    stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────
   Wordmark — "AI Partner" in tightened Geist with an amber
   underline that animates in on group-hover. Use alongside
   <MarkLogo /> to compose the full lockup.
   ─────────────────────────────────────────────────────────────── */
export function Wordmark({
  className,
  size = "md",
  inverse = false,
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  inverse?: boolean;
}) {
  const sz = {
    xs: "text-[13px]",
    sm: "text-[14.5px]",
    md: "text-[16px]",
    lg: "text-[20px]",
    xl: "text-[26px]",
  }[size];

  return (
    <span
      className={cn(
        "relative inline-block font-semibold tracking-[-0.018em] leading-none whitespace-nowrap",
        inverse ? "text-[hsl(36_30%_96%)]" : "text-foreground",
        sz,
        className,
      )}
    >
      AI&nbsp;Partner
      {/* Amber underline that pans in on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-1 h-[2px] origin-left scale-x-0 bg-amber transition-transform duration-360 ease-out-expo group-hover/brand:scale-x-100"
      />
    </span>
  );
}

/* ───────────────────────────────────────────────────────────────
   Lockup — Mark + Wordmark, the standard brand presentation.
   Used in headers, footers, auth screens.
   ─────────────────────────────────────────────────────────────── */
export function BrandLockup({
  className,
  size = "md",
  inverse = false,
  asLink = true,
  href = "/",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  inverse?: boolean;
  asLink?: boolean;
  href?: string;
}) {
  const markSize = {
    sm: 26,
    md: 32,
    lg: 40,
    xl: 56,
  }[size];

  const wordSize: React.ComponentProps<typeof Wordmark>["size"] = {
    sm: "sm",
    md: "md",
    lg: "lg",
    xl: "xl",
  }[size] as "sm" | "md" | "lg" | "xl";

  const inner = (
    <>
      <MarkLogo size={markSize} inverse={inverse} />
      <Wordmark size={wordSize} inverse={inverse} />
    </>
  );

  const cls = cn(
    "group/brand inline-flex items-center gap-2.5 select-none rounded-md outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );

  if (!asLink) return <span className={cls}>{inner}</span>;
  return (
    <Link href={href} className={cls} aria-label={`${BRAND.name} — Home`}>
      {inner}
    </Link>
  );
}

/* ───────────────────────────────────────────────────────────────
   Backwards-compatible Logo + LogoMark exports.
   Old call-sites:  <Logo size="sm" showBadge={false} />
   keep working — they now render the new mark + wordmark lockup.
   The `showBadge` prop becomes a no-op (the new wordmark is the
   identity by itself; "Platform" tagline was always noise).
   ─────────────────────────────────────────────────────────────── */
export function Logo({
  className,
  showBadge: _showBadge = false,
  size = "md",
  inverse = false,
}: {
  className?: string;
  showBadge?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  inverse?: boolean;
}) {
  return (
    <BrandLockup
      className={className}
      size={size}
      inverse={inverse}
    />
  );
}

/** Legacy alias — old code imports `LogoMark`. Keeps compiling. */
export { MarkLogo as LogoMark };
