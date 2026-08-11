/**
 * Zod schemas generated from the pillar field registry.
 *
 * Generating rather than hand-writing means the caps and character limits
 * declared in `partner-pillars.ts` are enforced server-side automatically. A
 * client that bypasses the UI still cannot claim 40 workloads or paste 5,000
 * characters of marketing copy into a 300-character field.
 *
 * Shared by `updatePartnerPillarsAction` and the wizard's per-step save.
 */

import { z } from "zod";
import {
  PILLAR_FIELDS,
  PILLAR_KEYS,
  type FieldMeta,
  type PillarKey,
} from "@/lib/partner-pillars";

/** Ceiling on repeater entries — enough for any real partner, bounded for us. */
const MAX_REPEATER_ENTRIES = 25;

const rangeSchema = z.object({
  low: z.number().finite().nullable().default(null),
  high: z.number().finite().nullable().default(null),
});

const ipAssetSchema = z.object({
  name: z.string().trim().max(120).default(""),
  category: z.string().trim().max(120).default(""),
  description: z.string().trim().max(300).default(""),
  access: z.string().trim().max(60).default(""),
  impact: z.string().trim().max(60).default(""),
  timeSaved: z.string().trim().max(120).default(""),
});

const caseStudySchema = z.object({
  title: z.string().trim().max(200).default(""),
  client: z.string().trim().max(160).default(""),
  industry: z.string().trim().max(120).default(""),
  summary: z.string().trim().max(600).default(""),
  outcome: z.string().trim().max(300).default(""),
  link: z.string().trim().max(500).default(""),
  engagementDate: z.string().trim().max(20).default(""),
  referenceAvailable: z.coerce.boolean().default(false),
  confidential: z.coerce.boolean().default(false),
});

const valueRangesSchema = z.object({
  cloudSavingsPct: rangeSchema.optional(),
  migrationMonths: rangeSchema.optional(),
});

/**
 * Schema for one registry field, honouring its control, cap and char limit.
 *
 * Every field is `.optional()` at the top level so the wizard can save a
 * single step without resending the whole profile — `pillarValuesToColumns`
 * only writes keys that are present.
 */
function schemaForField(field: FieldMeta): z.ZodTypeAny {
  switch (field.control) {
    case "tags": {
      // Values are tag ids, not labels. Existence is checked at write time;
      // here we only bound the count and shape.
      let arr = z.array(z.string().min(1).max(40));
      if (field.maxSelections) {
        arr = arr.max(
          field.maxSelections,
          `Pick at most ${field.maxSelections} for "${field.label}".`,
        );
      }
      return arr;
    }

    case "multi": {
      const allowed = (field.options ?? []).map((o) => o.value);
      let arr = z.array(
        z.string().refine((v) => allowed.includes(v), {
          message: `Unrecognised option for "${field.label}".`,
        }),
      );
      if (field.maxSelections) {
        arr = arr.max(
          field.maxSelections,
          `Pick at most ${field.maxSelections} for "${field.label}".`,
        );
      }
      return arr;
    }

    case "segmented": {
      const allowed = (field.options ?? []).map((o) => o.value);
      // "" is the unanswered state and must stay valid — required-ness is
      // enforced by the strength scorer at completion time, not per-save,
      // so a partner can always save partial progress.
      return z.string().refine((v) => v === "" || allowed.includes(v), {
        message: `Unrecognised option for "${field.label}".`,
      });
    }

    case "ratio":
      return z.number().int().min(0).max(100).nullable();

    case "range":
      return field.key === "valueRanges" ? valueRangesSchema : rangeSchema;

    case "repeater":
      return field.key === "ipAssets"
        ? z.array(ipAssetSchema).max(MAX_REPEATER_ENTRIES)
        : z.array(caseStudySchema).max(MAX_REPEATER_ENTRIES);

    case "text":
      return z.string().trim().max(field.charLimit ?? 300);
  }
}

/** Full pillar payload — every field optional, all caps enforced. */
export const PillarValuesSchema = z
  .object(
    Object.fromEntries(
      Object.values(PILLAR_FIELDS).map((f) => [
        f.key,
        schemaForField(f).optional(),
      ]),
    ) as Record<string, z.ZodTypeAny>,
  )
  .strict();

/**
 * Payload for saving a single wizard step: the pillar being saved plus the
 * values for it. Scoping the write to one pillar is what makes per-step tag
 * reconciliation safe — otherwise saving step 1 would clear steps 2–5.
 */
export const PillarStepSchema = z.object({
  pillar: z.enum(PILLAR_KEYS as unknown as [PillarKey, ...PillarKey[]]),
  values: PillarValuesSchema,
});

export type PillarValuesInput = z.infer<typeof PillarValuesSchema>;
