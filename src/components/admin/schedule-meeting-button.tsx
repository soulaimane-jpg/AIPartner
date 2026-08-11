"use client";

/**
 * Thin button wrapper that opens the `ScheduleMeetingDialog`. Lives as
 * its own component so server pages can render a button without
 * dragging the dialog tree into the static tree.
 */

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingDialogProps,
} from "./schedule-meeting-dialog";

export interface ScheduleMeetingButtonProps
  extends Omit<ScheduleMeetingDialogProps, "open" | "onOpenChange"> {
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function ScheduleMeetingButton({
  label = "Schedule meeting",
  variant = "default",
  size = "sm",
  className,
  ...dialogProps
}: ScheduleMeetingButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <CalendarPlus className="h-4 w-4 mr-1.5" />
        {label}
      </Button>
      <ScheduleMeetingDialog
        open={open}
        onOpenChange={setOpen}
        {...dialogProps}
      />
    </>
  );
}
