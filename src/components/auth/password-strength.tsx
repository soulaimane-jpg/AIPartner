"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function calcStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  const levels = [
    { label: "Too weak", color: "bg-destructive" },
    { label: "Weak", color: "bg-destructive" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Good", color: "bg-blue-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Very strong", color: "bg-emerald-600" },
  ];

  const idx = Math.min(score, 5);
  return { score: idx, ...levels[idx] };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = calcStrength(password);
  const segments = 5;

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < score ? color : "bg-secondary",
            )}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{label}</span>
      </p>
    </div>
  );
}
