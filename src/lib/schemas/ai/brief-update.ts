import { z } from "zod";

/**
 * Schema for the `<brief_update>` block the chat assistant emits.
 *
 * `/api/chat` was the only AI call site with no validation of model
 * output: `parseBriefUpdate` ran a `[\s\S]*?` regex, `JSON.parse`d the
 * result, and turned any failure into `{}` — a silent no-op the customer
 * experiences as "the AI ignored what I said". Every other call site goes
 * through `parseLlmJson` with a Zod schema, and this is the one users
 * touch most.
 *
 * `.strip()` semantics matter here: an unknown key would otherwise be
 * passed to `applyBriefPatch` and, if it happened to match a column name,
 * written to the brief. The chat channel is influenced by uploaded
 * documents, so that is an injection sink, not a hypothetical.
 */

const ShortText = z.string().trim().max(4_000);
const Label = z.string().trim().min(1).max(300);

/** Objects the contract defines, each with a tolerant shape. */
const TitleDetail = z.object({
  title: Label,
  detail: ShortText.optional().default(""),
});
const NameDetail = z.object({
  name: Label,
  detail: ShortText.optional().default(""),
});
const MetricTarget = z.object({
  metric: Label,
  target: ShortText.optional().default(""),
});
const Milestone = z.object({
  title: Label,
  date: z.string().trim().max(60).optional().default(""),
});

const StringList = z.array(Label).max(40);

export const BriefUpdateV1 = z
  .object({
    // String fields
    title: ShortText.optional(),
    executiveSummary: ShortText.optional(),
    targetGoLive: z.string().trim().max(120).optional(),
    budgetRange: z.string().trim().max(120).optional(),
    preferredLocation: z.string().trim().max(200).optional(),
    procurementType: z.string().trim().max(60).optional(),

    // JSON (array) fields
    scopeRequirements: z.array(TitleDetail).max(40).optional(),
    dataSources: z.array(NameDetail).max(40).optional(),
    integrationPoints: z.array(TitleDetail).max(40).optional(),
    successCriteria: z.array(MetricTarget).max(40).optional(),
    milestones: z.array(Milestone).max(40).optional(),
    customerRoles: StringList.optional(),
    requiredCertifications: StringList.optional(),
    industryExperience: StringList.optional(),
    decisionMakers: StringList.optional(),
    selectionCriteria: StringList.optional(),
    services: StringList.optional(),
  })
  // Drop anything not named above rather than forwarding it to the patch
  // applier. Unknown keys are either model drift or an injection attempt.
  .strip();

export type BriefUpdateV1 = z.infer<typeof BriefUpdateV1>;

export const AnswerRatingV1 = z
  .object({
    score: z.coerce.number().min(0).max(100),
    strengths: z.array(z.string().trim().max(300)).max(3).default([]),
    suggestion: z.string().trim().max(1_000).default(""),
  })
  .strip();

export type AnswerRatingV1 = z.infer<typeof AnswerRatingV1>;

/** Why an extraction was discarded — surfaced to the user. */
export type BriefUpdateFailure =
  | { code: "absent" }
  | { code: "malformed_json" }
  | { code: "schema_mismatch"; issues: string[] };

export type BriefUpdateParse =
  | { ok: true; patch: BriefUpdateV1; droppedKeys: string[] }
  | { ok: false; failure: BriefUpdateFailure };
