import * as React from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE = [
  "flex w-full rounded-md text-[13.5px] text-foreground",
  "bg-card border border-line",
  "placeholder:text-subtle",
  "disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-surface-2",
  "transition-[border-color,box-shadow,background-color] duration-160 ease-out-quart",
  "shadow-[var(--elev-1)]",
  "hover:border-line-strong",
  // Brand-tinted focus glow
  "focus-visible:outline-none focus-visible:border-brand-1",
  "focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-1)/0.16),var(--elev-1)]",
  // Error
  "aria-[invalid=true]:border-danger",
  "aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_hsl(var(--danger)/0.18),var(--elev-1)]",
  // Read-only
  "read-only:bg-surface-2 read-only:cursor-default read-only:focus-visible:shadow-[var(--elev-1)] read-only:focus-visible:border-line",
].join(" ");

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(FIELD_BASE, "h-9 px-3 py-1.5", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(FIELD_BASE, "min-h-[88px] px-3 py-2.5 leading-[1.55] resize-none", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/**
 * Wrap an input with leading/trailing icon or addon text. Pure layout —
 * the underlying field still receives focus and keeps its full styling.
 *
 *   <InputGroup leftIcon={<Mail/>}>
 *     <Input placeholder="name@company.com" />
 *   </InputGroup>
 */
export function InputGroup({
  leftIcon,
  rightIcon,
  className,
  children,
}: {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative",
        "[&>input]:pl-9 [&>input]:pr-3",
        rightIcon && "[&>input]:pr-9",
        !leftIcon && "[&>input]:pl-3",
        className,
      )}
    >
      {leftIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center text-muted-foreground [&_svg]:size-4">
          {leftIcon}
        </span>
      )}
      {children}
      {rightIcon && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center text-muted-foreground [&_svg]:size-4">
          {rightIcon}
        </span>
      )}
    </div>
  );
}
