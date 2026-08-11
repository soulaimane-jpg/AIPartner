import { cn } from "@/lib/utils";

/**
 * Bespoke icon set for AI Partner — designed to match the brand's
 * orbital-arcs visual language (curves, dots, layered depth).
 *
 * Each icon is a 24×24 viewBox SVG with `currentColor` strokes/fills so
 * a parent text color drives the tint. They have an internal "amber" /
 * "magenta" highlight via `text-magenta-1` overrides (pass via parent).
 *
 * Style rules:
 *   - 1.6 stroke width
 *   - rounded line caps + joins
 *   - one signature accent dot in magenta where it makes sense
 *   - subtle layered depth (a faint ghost stroke behind the main one)
 */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Base({
  size = 24,
  className,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      stroke="currentColor"
      aria-hidden
      className={cn(className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ─── AI scoping (chat bubble + sparkle) ──────────────────────────── */
export function ScopeIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* Bubble */}
      <path
        d="M5 6.5C5 5.4 5.9 4.5 7 4.5h10c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2H10l-3.5 3v-3H7c-1.1 0-2-.9-2-2V6.5Z"
        opacity="0.9"
      />
      {/* Sparkle inside */}
      <path d="M12 7v2.2M12 11.8V14M9.7 9.5h2.3M12 9.5h2.3" />
      {/* Magenta accent dot */}
      <circle cx="18.5" cy="3.5" r="1.5" fill="hsl(var(--magenta-1))" stroke="none" />
      <circle cx="18.5" cy="3.5" r="3" fill="hsl(var(--magenta-1))" stroke="none" opacity="0.18" />
    </Base>
  );
}

/* ─── Partner network (3 nodes connected by orbits) ───────────────── */
export function NetworkIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* Orbital ring */}
      <ellipse cx="12" cy="12" rx="9" ry="6" opacity="0.45" />
      {/* Three nodes */}
      <circle cx="3.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6" r="1.8" fill="hsl(var(--magenta-1))" stroke="none" />
      <circle cx="12" cy="6" r="3.4" fill="hsl(var(--magenta-1))" stroke="none" opacity="0.18" />
      {/* Connecting line */}
      <path d="M3.5 12c2 -3 5 -5 8.5 -6 3.5 1 6.5 3 8.5 6" />
    </Base>
  );
}

/* ─── Side-by-side compare (split panes with check) ───────────────── */
export function CompareIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* Left pane */}
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <path d="M5.5 8.5h3M5.5 11h3M5.5 13.5h3" opacity="0.55" />
      {/* Right pane (winner — magenta tint) */}
      <rect
        x="13"
        y="5"
        width="8"
        height="14"
        rx="1.5"
        stroke="hsl(var(--magenta-1))"
      />
      <path
        d="M15.5 8.5h3M15.5 11h3M15.5 13.5h3"
        stroke="hsl(var(--magenta-1))"
        opacity="0.65"
      />
      {/* Check mark badge */}
      <circle
        cx="20"
        cy="5.5"
        r="2.4"
        fill="hsl(var(--magenta-1))"
        stroke="none"
      />
      <path
        d="M19 5.6 19.7 6.4 21.2 4.8"
        stroke="white"
        strokeWidth="1.4"
      />
    </Base>
  );
}

/* ─── Audit trail (timeline + shield) ──────────────────────────────── */
export function ShieldTrailIcon(props: IconProps) {
  return (
    <Base {...props}>
      {/* Timeline line */}
      <path d="M3 16h14" opacity="0.55" />
      {/* Timeline dots */}
      <circle cx="5" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="1.6" fill="hsl(var(--magenta-1))" stroke="none" />
      {/* Shield (above last dot) */}
      <path
        d="M15 4 18.5 5.4v3c0 2.4 -1.6 4.4 -3.5 5 -1.9 -.6 -3.5 -2.6 -3.5 -5v-3L15 4Z"
        opacity="0.95"
      />
      <path d="M13.5 8.6 14.7 9.7 16.6 7.5" strokeWidth="1.4" />
    </Base>
  );
}

/* ─── Magnifier / scope (used for "Scoping" feature) ──────────────── */
export function MagnifierIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4 4" />
      {/* Inside the lens — sparkle */}
      <path d="M10.5 8v2.4M10.5 10.4V13M8.5 10.5h2M10.5 10.5h2" opacity="0.7" />
      <circle cx="19" cy="5" r="1.2" fill="hsl(var(--magenta-1))" stroke="none" />
    </Base>
  );
}

/* ─── Stack / layers (used for "Workspace") ───────────────────────── */
export function StackIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 21 7.5 12 12 3 7.5 12 3Z" />
      <path d="M3 12.5 12 17l9 -4.5" opacity="0.7" />
      <path d="M3 17.5 12 22l9 -4.5" opacity="0.4" />
      <circle cx="12" cy="3" r="1.4" fill="hsl(var(--magenta-1))" stroke="none" />
    </Base>
  );
}

/* ─── Lightning / acceleration ────────────────────────────────────── */
export function BoltIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13.5 2.5 4 14h6.5L9 21.5 19.5 9H13l.5 -6.5Z" />
      <circle cx="20" cy="3.5" r="1.4" fill="hsl(var(--magenta-1))" stroke="none" />
    </Base>
  );
}

/* ─── Globe / region ──────────────────────────────────────────────── */
export function GlobeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="3.4" ry="9" opacity="0.6" />
      <path d="M3 12h18" opacity="0.6" />
      <circle cx="12" cy="6" r="1.4" fill="hsl(var(--magenta-1))" stroke="none" />
    </Base>
  );
}
