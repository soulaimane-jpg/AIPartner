/**
 * AI-drafted outreach email — the contract Claude returns when an
 * admin clicks "Compose outreach (AI draft)" in the sourcing room.
 *
 * The admin always sees + edits the draft before send — this is
 * assist, not autopilot. We still validate the structure so a
 * malformed LLM response can't crash the composer.
 */

import { z } from "zod";

export const OutreachDraftV1 = z
  .object({
    /** Subject line. Plain text, ≤ 140 chars (most email clients
     *  truncate around 80 — Claude tends to go long if unconstrained). */
    subject: z.string().min(4).max(140),
    /** Body — plain text with newlines. Markdown not allowed because
     *  we render this in a textarea + email client mixed environment. */
    body: z.string().min(40).max(4000),
    /** Optional one-line "why I'm reaching out" summary. The composer
     *  shows this above the body as a reviewer aid. */
    fitNote: z.string().max(280).nullable().default(null),
  })
  .strict();

export type OutreachDraftV1 = z.infer<typeof OutreachDraftV1>;

export const OUTREACH_DRAFT_VERSION = "v1" as const;
