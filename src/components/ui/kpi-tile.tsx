import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/ui/sparkline";
import { NumberFlow } from "@/components/ui/number-flow";

export type KpiTileProps = {
  label: string;
  value: number;
  /** Used for NumberFlow formatting (e.g. "1,234"). Defaults to integer locale. */
  format?: (n: number) => string;
  /** Optional unit suffix shown after the number (e.g. "%", "h"). */
  suffix?: string;
  /** Optional unit prefix shown before the number (e.g. "$"). */
  prefix?: string;
  /**
   * Direction + magnitude vs. previous period. Pass `null` to render no
   * delta. Use a positive number for an "up" delta, negative for "down".
   */
  delta?: number | null;
  /**
   * Whether positive delta is "good" (default true). For metrics like
   * latency or churn this should be `false` so the up-arrow is red.
   */
  goodDirection?: "up" | "down";
  /** Optional sparkline data; shown along the bottom edge. */
  trend?: number[];
  /** Optional small icon shown to the left of the label. */
  icon?: React.ReactNode;
  className?: string;
};

const fmtInt = (n: number) => n.toLocaleString();

/**
 * Single KPI tile composed of label, animated number, optional trend
 * sparkline, and a delta chip.
 *
 *   <KpiTile label="Briefs created" value={42} delta={+18} trend={[…]} />
 */
export function KpiTile({
  label,
  value,
  format = fmtInt,
  prefix,
  suffix,
  delta,
  goodDirection = "up",
  trend,
  icon,
  className,
}: KpiTileProps) {
  const sign =
    delta == null ? null : delta === 0 ? 0 : delta > 0 ? 1 : -1;

  // Determine "good vs bad" based on direction config.
  const isGood =
    sign === null
      ? null
      : sign === 0
        ? null
        : (goodDirection === "up" && sign === 1) ||
          (goodDirection === "down" && sign === -1);

  const Arrow =
    sign === null || sign === 0
      ? Minus
      : sign === 1
        ? ArrowUpRight
        : ArrowDownRight;

  const deltaTone =
    isGood == null
      ? "bg-secondary text-muted-foreground"
      : isGood
        ? "bg-success/10 text-success"
        : "bg-danger/10 text-danger";

  return (
    <div
      className={cn(
        "card-raised relative overflow-hidden p-5",
        "transition-[box-shadow,border-color] duration-160 ease-out-quart",
        "hover:shadow-elev-2 hover:border-line-strong",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
        <span className="text-[12.5px] font-medium tracking-[-0.005em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="mt-2.5 flex items-end gap-2.5">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {prefix && <span className="text-muted-foreground/80 mr-0.5">{prefix}</span>}
          <NumberFlow value={value} format={format} />
          {suffix && <span className="text-muted-foreground/80 ml-0.5 text-[20px]">{suffix}</span>}
        </span>

        {sign !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 mb-0.5",
              "text-[11px] font-semibold tabular-nums [&_svg]:size-3",
              deltaTone,
            )}
          >
            <Arrow />
            {Math.abs(delta as number)}
            {suffix === "%" && "%"}
          </span>
        )}
      </div>

      {trend && trend.length > 1 && (
        <div
          className={cn(
            "mt-3 -mx-1",
            isGood == null
              ? "text-muted-foreground"
              : isGood
                ? "text-success"
                : "text-danger",
          )}
        >
          <Sparkline data={trend} width={220} height={36} fill />
        </div>
      )}
    </div>
  );
}
