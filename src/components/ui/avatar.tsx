import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-grid place-items-center shrink-0 select-none overflow-hidden ring-1 ring-inset ring-white/15 text-white shadow-elev-1",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-7 w-7 text-[11px]",
        md: "h-8 w-8 text-[12px]",
        lg: "h-10 w-10 text-[13px]",
        xl: "h-14 w-14 text-[16px]",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: { size: "md", shape: "circle" },
  },
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** Display name; used to derive initials when no `src`. */
  name: string;
  src?: string | null;
  /** Optional status dot bottom-right. */
  status?: "online" | "away" | "busy" | "offline";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic gradient pair from name so the same person always gets the
 *  same avatar. Six-step palette using brand and complementary hues. */
function gradientFor(name: string) {
  const PALETTE = [
    ["234 89% 60%", "274 84% 62%"], // indigo→violet (brand)
    ["192 90% 52%", "234 89% 60%"], // cyan→indigo
    ["274 84% 62%", "330 81% 60%"], // violet→pink
    ["152 60% 38%", "192 90% 52%"], // green→cyan
    ["32 92% 48%",  "0 72% 52%"],   // amber→red
    ["210 90% 50%", "274 84% 62%"], // sky→violet
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const [a, b] = PALETTE[Math.abs(h) % PALETTE.length];
  return `linear-gradient(135deg, hsl(${a}) 0%, hsl(${b}) 100%)`;
}

const STATUS_TINT = {
  online:  "bg-success",
  away:    "bg-warning",
  busy:    "bg-danger",
  offline: "bg-line-strong",
} as const;

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, shape, name, src, status, style, ...props }, ref) => {
    const bg = src ? undefined : gradientFor(name);
    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size, shape }), className)}
        style={{ background: bg, ...style }}
        aria-label={name}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="font-semibold tracking-tight leading-none">
            {initialsOf(name)}
          </span>
        )}
        {status && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full ring-2 ring-card",
              STATUS_TINT[status],
              size === "xs" || size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
            )}
          />
        )}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";

/** Stacked group of avatars with overlap. */
export function AvatarGroup({
  className,
  max = 4,
  children,
}: {
  className?: string;
  max?: number;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visible.map((c, i) => (
        <span
          key={i}
          className="rounded-full ring-2 ring-card transition-transform duration-160 ease-out-quart hover:translate-y-[-1px] hover:z-10"
        >
          {c}
        </span>
      ))}
      {overflow > 0 && (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground ring-2 ring-card">
          +{overflow}
        </span>
      )}
    </div>
  );
}
