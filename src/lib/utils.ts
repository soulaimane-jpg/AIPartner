import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents?: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export function initials(name?: string | null) {
  if (!name) return "··";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const table: [number, string][] = [
    [60, "just now"],
    [3600, "m ago"],
    [86400, "h ago"],
    [2592000, "d ago"],
    [31536000, "mo ago"],
  ];
  if (seconds < 60) return "just now";
  for (let i = 1; i < table.length; i++) {
    const [limit, suffix] = table[i];
    if (seconds < limit) {
      const prev = table[i - 1][0];
      const val = Math.floor(seconds / prev);
      return `${val}${suffix}`;
    }
  }
  return `${Math.floor(seconds / 31536000)}y ago`;
}
