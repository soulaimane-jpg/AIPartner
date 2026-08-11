/**
 * Zod mirrors of the string-union enums in `@/lib/enums`.
 *
 * We export both the Zod schemas (for validation at boundaries) and the
 * raw `as const` arrays (for select-options + iteration). New enum
 * values land in `enums.ts`, then mirror here.
 */

import { z } from "zod";
import {
  USER_ROLES,
  LEAD_STATUSES,
  COMPANY_KINDS,
  PARTNER_TIER_VALUES,
  BRIEF_STAGES,
  BRIEF_STATUSES,
  SERVICE_CATEGORIES,
  PROCUREMENT_TYPES,
  MATCH_STATUSES,
  COLLABORATOR_ROLES,
  COLLABORATOR_STATUSES,
  PROPOSAL_STATUSES,
} from "@/lib/enums";

export const ZUserRole = z.enum(USER_ROLES);
export const ZLeadStatus = z.enum(LEAD_STATUSES);
export const ZCompanyKind = z.enum(COMPANY_KINDS);
export const ZPartnerTier = z.enum(PARTNER_TIER_VALUES);
export const ZBriefStage = z.enum(BRIEF_STAGES);
export const ZBriefStatus = z.enum(BRIEF_STATUSES);
export const ZServiceCategory = z.enum(SERVICE_CATEGORIES);
export const ZProcurement = z.enum(PROCUREMENT_TYPES);
export const ZMatchStatus = z.enum(MATCH_STATUSES);
export const ZCollaboratorRole = z.enum(COLLABORATOR_ROLES);
export const ZCollaboratorStatus = z.enum(COLLABORATOR_STATUSES);
export const ZProposalStatus = z.enum(PROPOSAL_STATUSES);
