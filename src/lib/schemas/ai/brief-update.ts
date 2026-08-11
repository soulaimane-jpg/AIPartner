/**
 * Zod schema for the `<brief_update>` JSON contract emitted by the
 * scoping copilot. **Versioned** — never edit `v1` in place; bump to
 * `v2` and migrate consumers. The schema is the source of truth for
 * what Claude is allowed to return.
 *
 * Why this matters: the prompt is in English, the contract is in JSON,
 * and Claude *will* drift. Without strict parsing + retry the brief
 * silently fills with garbage.
 */

import { z } from "zod";

/** A single, atomic patch to the draft `ProjectBrief`. */
export const BriefUpdatePatchV1 = z
  .object({
    title: z.string().min(2).max(200).optional(),
    executiveSummary: z.string().max(2000).optional(),
    scopeRequirements: z.string().max(5000).optional(),
    integrationPoints: z.string().max(5000).optional(),
    dataSources: z.string().max(5000).optional(),
    successCriteria: z.string().max(5000).optional(),
    targetGoLive: z.string().max(120).optional(),
    budgetRange: z.string().max(120).optional(),
    preferredLocation: z.string().max(200).optional(),
    requiredCertifications: z.string().max(2000).optional(),
  })
  .strict();

export type BriefUpdatePatchV1 = z.infer<typeof BriefUpdatePatchV1>;

export const BRIEF_UPDATE_VERSION = "v1" as const;
