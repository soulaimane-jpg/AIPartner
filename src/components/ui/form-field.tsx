import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard label + control + helper + error wrapper. Every form on the app
 * should compose its inputs through `FormField` so error / helper / required
 * affordances stay identical everywhere.
 *
 *   <FormField label="Work email" htmlFor="email" required helper="Used for sign-in.">
 *     <Input id="email" name="email" type="email" />
 *   </FormField>
 *
 *   <FormField label="…" error="That email is taken">
 *     <Input aria-invalid />
 *   </FormField>
 */
export interface FormFieldProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  /** Hint pinned to the right of the label (e.g. char counter). */
  rightLabel?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  optional,
  helper,
  error,
  rightLabel,
  className,
  children,
  ...rest
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...rest}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={htmlFor}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground"
            >
              {label}
              {required && (
                <span aria-hidden className="text-danger">*</span>
              )}
              {optional && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  (optional)
                </span>
              )}
            </label>
          )}
          {rightLabel && (
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {rightLabel}
            </span>
          )}
        </div>
      )}

      {children}

      {(helper || error) && (
        <p
          className={cn(
            "flex items-start gap-1.5 text-[11.5px] leading-snug",
            error ? "text-danger" : "text-muted-foreground",
          )}
        >
          {error && <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />}
          <span>{error ?? helper}</span>
        </p>
      )}
    </div>
  );
}
