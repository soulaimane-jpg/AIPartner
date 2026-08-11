/**
 * Sourcing rationale — Claude's "why this partner fits" explanation
 * for an admin's triage room.
 *
 * Versioned (`v1`). Frozen once shipped — never edit in place. Prompt
 * evolution → new version + migration of cached `Match.matchRationale`.
 */

import { z } from "zod";

export const SourcingRationaleV1 = z
  .object({
    /** 0-100 confidence Claude has in this match (separate from
     *  `match-score.ts`'s deterministic score). */
    confidence: z.number().int().min(0).max(100),
    /** 1-2 sentence "why this fits" — shown verbatim on the card. */
    rationale: z.string().min(20).max(420),
    /** ≤ 5 short bullet keywords driving the match (e.g. "BigQuery
     *  Premier", "EMEA delivery", "FSI experience"). */
    strengths: z.array(z.string().max(60)).max(5).default([]),
    /** ≤ 3 caveats the admin should keep in mind. */
    caveats: z.array(z.string().max(120)).max(3).default([]),
  })
  .strict();

export type SourcingRationaleV1 = z.infer<typeof SourcingRationaleV1>;

export const SOURCING_RATIONALE_VERSION = "v1" as const;
