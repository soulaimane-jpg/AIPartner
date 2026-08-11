"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy link",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-success" />
          <span className="text-success">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" /> {label}
        </>
      )}
    </button>
  );
}
