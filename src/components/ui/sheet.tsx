"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[hsl(220_30%_8%/0.5)] backdrop-blur-md backdrop-saturate-150",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      "data-[state=open]:duration-180 data-[state=closed]:duration-120",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col bg-card text-card-foreground border border-line shadow-elev-5",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:duration-280 data-[state=closed]:duration-180",
  ].join(" "),
  {
    variants: {
      side: {
        top:    "inset-x-0 top-0 border-b border-l-0 border-r-0 border-t-0 rounded-b-2xl data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
        bottom: "inset-x-0 bottom-0 border-t border-l-0 border-r-0 border-b-0 rounded-t-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        left:   "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r border-t-0 border-b-0 border-l-0 rounded-r-2xl data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        right:  "inset-y-0 right-0 h-full w-3/4 sm:max-w-md border-l border-t-0 border-b-0 border-r-0 rounded-l-2xl data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Set false to hide the default close button. */
  showClose?: boolean;
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side, className, children, showClose = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors duration-120 ease-out-quart hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1.5 p-5 sm:p-6 border-b border-line",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

export const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 p-5 sm:p-6 border-t border-line mt-auto",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-[17px] font-semibold leading-tight tracking-[-0.012em] text-foreground",
      className,
    )}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13.5px] text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto p-5 sm:p-6", className)}
    {...props}
  />
);
SheetBody.displayName = "SheetBody";
