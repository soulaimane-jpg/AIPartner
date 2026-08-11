import { cn } from "@/lib/utils";

/**
 * Tiny SVG sparkline — 7-day-style microchart used in dashboard KPI cards.
 *
 * No charting lib (saves ~80 kB). Renders a smooth path + soft area fill,
 * fully driven by `currentColor` so callers control the hue with text-* /
 * stroke-* utilities.
 *
 *  • If the array contains <2 points it renders a flat baseline.
 *  • The viewBox is independent of width/height props so it stays crisp.
 */
export function Sparkline({
  data,
  width = 92,
  height = 28,
  className,
  fill = true,
  strokeWidth = 1.6,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Render the soft area fill below the line. */
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (!data.length) {
    return <div className={cn("inline-block", className)} style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 1); // avoid div-by-zero on flat series
  const w = 100;
  const h = 30;

  const points = data.map((v, i) => {
    const x = data.length === 1 ? 0 : (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y] as const;
  });

  // Catmull-Rom-ish smoothed line (cheaper than full curve fitting).
  const linePath = points
    .map(([x, y], i) => {
      if (i === 0) return `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      const [px, py] = points[i - 1];
      const cx = (px + x) / 2;
      return `Q ${cx.toFixed(2)} ${py.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("text-primary", className)}
      aria-hidden
    >
      {fill && (
        <path
          d={areaPath}
          fill="currentColor"
          fillOpacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
