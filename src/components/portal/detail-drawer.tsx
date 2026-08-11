"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Slide‑in side drawer used by table/list pages to show item detail
 * without navigating away. Built on Radix Dialog so we get focus
 * management, escape‑to‑close and accessible labelling for free.
 *
 * Usage:
 *
 *   <DetailDrawer
 *     open={!!selected}
 *     onOpenChange={(o) => !o && setSelected(null)}
 *     title="Acme — Lead detail"
 *     subtitle="Invited 3 days ago"
 *   >
 *     ...
 *   </DetailDrawer>
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  width = 520,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Pixel width on desktop; mobile is always full‑width. */
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-[hsl(220_30%_8%/0.55)] backdrop-blur-md backdrop-saturate-150",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-180 data-[state=closed]:duration-120",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col bg-white border-l border-border shadow-elev-4",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-right",
            "data-[state=closed]:slide-out-to-right",
            "data-[state=open]:duration-280 data-[state=closed]:duration-200",
            "w-full max-w-full sm:max-w-[var(--drawer-w)]",
          )}
          style={{ ["--drawer-w" as string]: `${width}px` }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[16px] font-semibold leading-tight text-foreground truncate">
                {title}
              </DialogPrimitive.Title>
              {subtitle && (
                <div className="mt-1 text-[12.5px] text-muted-foreground truncate">
                  {subtitle}
                </div>
              )}
            </div>
            <DialogPrimitive.Close
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition shrink-0"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-border bg-secondary/20 px-6 py-3 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
