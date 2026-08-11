/**
 * Zod schemas for ProjectBrief operations. Used by both the Server
 * Actions and the React Hook Form on the new-brief page so input
 * validation is identical client-side and server-side.
 */

import { z } from "zod";
import {
  ZProcurement,
  ZServiceCategory,
  ZBriefStage,
} from "./enums";
import { BriefId, ShortText } from "./base";

// ─── 3-step qualification modal → createBriefAction ───────────────

export const CreateBriefInput = z.object({
  services: z
    .array(ZServiceCategory)
    .min(1, "Select at least one service")
    .max(SERVICE_LIMIT()),
  deliveryModel: z
    .array(z.enum(["project", "ongoing", "advisory"]))
    .max(3)
    .default([]),
  targetStartDate: z.string().trim().max(40).optional(),
  estimatedBudget: z.string().trim().max(100).optional(),
  title: ShortText.optional(),
  usesCloud: z.coerce.boolean().optional(),
  hadPartner: z.coerce.boolean().optional(),
  procurement: ZProcurement.optional(),
});
export type CreateBriefInput = z.infer<typeof CreateBriefInput>;

function SERVICE_LIMIT() {
  return 8;
}

// ─── Patch a brief from the document editor ───────────────────────

/**
 * Patch is intentionally permissive at the schema level — the editor
 * surfaces dozens of fields and we want to keep them serialisable
 * without per-key validation here. The Server Action rejects unknown
 * keys via an allow-list, so we still get safety.
 */
export const UpdateBriefInput = z.object({
  briefId: BriefId,
  patch: z.record(z.string(), z.unknown()),
});
export type UpdateBriefInput = z.infer<typeof UpdateBriefInput>;

/** Allow-list of keys the patch endpoint will write to. */
export const BRIEF_PATCH_ALLOWED_FIELDS = [
  "title",
  "executiveSummary",
  "scopeRequirements",
  "dataSources",
  "integrationPoints",
  "successCriteria",
  "customerRoles",
  "targetGoLive",
  "milestones",
  "budgetRange",
  "budgetNotes",
  "preferredLocation",
  "requiredCertifications",
  "industryExperience",
  "procurementType",
  "decisionMakers",
  "selectionCriteria",
  "legalTimeline",
  "services",
  "stage",
  "status",
] as const;

/** Fields that store JSON in their string column. */
export const BRIEF_JSON_FIELDS = new Set([
  "scopeRequirements",
  "dataSources",
  "integrationPoints",
  "successCriteria",
  "customerRoles",
  "milestones",
  "requiredCertifications",
  "industryExperience",
  "decisionMakers",
  "selectionCriteria",
  "services",
]);

// ─── Submit a brief (with optional meeting picker) ─────────────────

export const MeetingSlot = z.object({
  startsAt: z.string().min(1).datetime({ offset: true }).or(z.string().min(1)),
  durationMins: z.coerce.number().int().min(15).max(240).default(30),
});

export const SubmitBriefInput = z.object({
  briefId: BriefId,
  meeting: z
    .object({
      proposedSlots: z
        .array(MeetingSlot)
        .min(1, "Propose at least one time slot")
        .max(3, "Propose up to three time slots"),
      agenda: z.string().trim().max(2000).optional(),
    })
    .optional(),
});
export type SubmitBriefInput = z.infer<typeof SubmitBriefInput>;

// ─── Approve / decline a match (customer side) ────────────────────

export const MatchActionInput = z.object({
  matchId: z.string().min(8).max(64),
});
export type MatchActionInput = z.infer<typeof MatchActionInput>;

// ─── Stage advance (admin) ────────────────────────────────────────

export const AdvanceStageInput = z.object({
  briefId: BriefId,
  to: ZBriefStage,
});
export type AdvanceStageInput = z.infer<typeof AdvanceStageInput>;

// ─── Delete a brief ───────────────────────────────────────────────

export const DeleteBriefInput = z.object({ briefId: BriefId });
export type DeleteBriefInput = z.infer<typeof DeleteBriefInput>;
