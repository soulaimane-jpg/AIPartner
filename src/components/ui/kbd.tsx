import { cn } from "@/lib/utils";

const KEY_MAP: Record<string, string> = {
  cmd:    "⌘",
  meta:   "⌘",
  ctrl:   "⌃",
  alt:    "⌥",
  option: "⌥",
  shift:  "⇧",
  enter:  "↵",
  return: "↵",
  esc:    "Esc",
  escape: "Esc",
  tab:    "⇥",
  space:  "␣",
  up:     "↑",
  down:   "↓",
  left:   "←",
  right:  "→",
  bksp:   "⌫",
  back:   "⌫",
  del:    "⌦",
};

function pretty(token: string) {
  const t = token.toLowerCase();
  return KEY_MAP[t] ?? token.toUpperCase();
}

/**
 * Keyboard hint chip. Pass either a single key:
 *
 *   <Kbd>K</Kbd>
 *
 * or a chord array which renders as separated boxes:
 *
 *   <Kbd keys={["cmd", "K"]} />
 */
export function Kbd({
  keys,
  children,
  className,
  size = "md",
  separator = "",
}: {
  keys?: (string | number)[];
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
  separator?: string;
}) {
  const tokens = keys ?? (children ? [String(children)] : []);
  const baseSize =
    size === "sm" ? "h-[18px] min-w-[18px] text-[10px] px-1" : "h-5 min-w-[20px] text-[11px] px-1.5";

  return (
    <span className={cn("inline-flex items-center gap-0.5 align-middle", className)}>
      {tokens.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && separator && (
            <span className="text-muted-foreground/60">{separator}</span>
          )}
          <kbd
            className={cn(
              "inline-grid place-items-center rounded-[5px] font-medium font-mono",
              "bg-surface-2 border border-line text-muted-foreground",
              "shadow-[inset_0_-1px_0_hsl(var(--line))]",
              baseSize,
            )}
          >
            {pretty(String(t))}
          </kbd>
        </span>
      ))}
    </span>
  );
}
