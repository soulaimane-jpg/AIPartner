/**
 * Base Zod primitives reused across the codebase.
 *
 * - **Brand types** for IDs so the type-system distinguishes a `BriefId`
 *   from a `UserId` even though both are runtime strings.
 * - **Pagination**, **DateTime**, **Money** helpers — coerce loose input
 *   into well-typed values with sensible defaults.
 *
 * Import-only style: this module exports schemas + types; it does not
 * touch I/O or globals, so it's safe in client and server code alike.
 */

import { z } from "zod";

// ─── Branded ID types ─────────────────────────────────────────────
//
// Every `id` column comes back as a plain `string`, which is correct at
// the row level but loses any safety at the application layer (passing
// a `BriefId` to something that expected a `UserId` typechecks).
// Branding gives us nominal typing without a runtime cost.

const cuidLike = z.string().min(8).max(64);

export const UserId = cuidLike.brand<"UserId">();
export type UserId = z.infer<typeof UserId>;

export const CompanyId = cuidLike.brand<"CompanyId">();
export type CompanyId = z.infer<typeof CompanyId>;

export const BriefId = cuidLike.brand<"BriefId">();
export type BriefId = z.infer<typeof BriefId>;

export const MatchId = cuidLike.brand<"MatchId">();
export type MatchId = z.infer<typeof MatchId>;

export const ProposalId = cuidLike.brand<"ProposalId">();
export type ProposalId = z.infer<typeof ProposalId>;

export const CollaboratorId = cuidLike.brand<"CollaboratorId">();
export type CollaboratorId = z.infer<typeof CollaboratorId>;

export const LeadId = cuidLike.brand<"LeadId">();
export type LeadId = z.infer<typeof LeadId>;

export const NotificationId = cuidLike.brand<"NotificationId">();
export type NotificationId = z.infer<typeof NotificationId>;

// ─── Common scalars ───────────────────────────────────────────────

/// ISO-8601 datetime string, coerced to `Date`.
export const DateTimeUtc = z
  .union([z.string().datetime({ offset: true }), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

/// Trim + bounded non-empty string. Use for short fields (titles, names).
export const ShortText = z.string().trim().min(1).max(200);

/// Trim + bounded; allows empty.
export const OptionalShortText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal("").transform(() => undefined));

/// Long form free-text capped at a generous size to prevent abuse.
export const LongText = z.string().trim().max(20_000);

/// Email — normalised to lowercase, trimmed.
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Enter a valid email" });

/// Cents (integer) — money is never a float.
export const MoneyCents = z.number().int().min(0).max(1_000_000_000);

/// Locale code (BCP-47).
export const Locale = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Invalid locale (e.g. 'en' or 'en-GB')");

// ─── Pagination ───────────────────────────────────────────────────

export const Pagination = z.object({
  /// 1-based page index — UIs map cleanly.
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  /// Page size with a hard ceiling to prevent unbounded reads.
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type Pagination = z.infer<typeof Pagination>;

/// Cursor-based pagination — preferred over offset for hot reads.
export const Cursor = z.object({
  cursor: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
export type Cursor = z.infer<typeof Cursor>;

// ─── JSON helpers ─────────────────────────────────────────────────

/// Treat a Postgres TEXT column that *holds* JSON as a typed value.
/// Use as `JsonStringAs(MySchema)` and you'll get the typed value back.
export function JsonStringAs<T extends z.ZodTypeAny>(inner: T) {
  return z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid JSON",
        });
        return z.NEVER;
      }
    })
    .pipe(inner);
}

// ─── Tagging helpers ─────────────────────────────────────────────

/// Convenience: cast a plain string to a brand at runtime when you've
/// already proven its origin (e.g. from session). Avoids a re-parse.
export const asUserId = (s: string) => s as UserId;
export const asCompanyId = (s: string) => s as CompanyId;
export const asBriefId = (s: string) => s as BriefId;
export const asMatchId = (s: string) => s as MatchId;
export const asProposalId = (s: string) => s as ProposalId;
