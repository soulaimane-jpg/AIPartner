/**
 * Condition implementations for the RBAC matrix.
 *
 * A condition is a pure function `(ctx, payload, resource?) → boolean`
 * (or `Promise<boolean>` if it has to read the database). The set of
 * recognised condition keys is enumerated in `matrix.ts → CONDITION_KEYS`.
 *
 * **Lookups stay cheap.** Each condition runs on every action call, so
 * favour bounded queries (single-row by primary key) and aggressive
 * caching when adding new ones. We deliberately don't memoise here —
 * route-level caching (RSC dedupe) handles repeats in the same request.
 */

import { queryOne } from "@/lib/db";
import { getBriefCapabilities } from "@/lib/workspace-access";
import type { ConditionKey } from "./matrix";
import type { ActionContext } from "./types";

type Payload = Record<string, unknown>;

const conditions: Record<
  ConditionKey,
  (ctx: ActionContext, payload: Payload) => boolean | Promise<boolean>
> = {
  /** ctx.user can edit the brief referenced by payload.briefId. */
  isOwnBrief: async (ctx, payload) => {
    const id = pickId(payload, "briefId", "id");
    if (!id || !ctx.user?.id) return false;
    const capabilities = await getBriefCapabilities(
      { userId: ctx.user.id, companyId: ctx.user.companyId, platformRole: ctx.user.role },
      id,
    );
    return capabilities.canEditBrief;
  },

  /** ctx.user.companyId matches the resource's tenant. */
  isCompanyMember: (ctx, payload) => {
    const cid = pickId(payload, "companyId", "tenantId");
    return Boolean(ctx.user?.companyId && cid && ctx.user.companyId === cid);
  },

  /** ctx.user has active access to payload.briefId. */
  isCollaborator: async (ctx, payload) => {
    const briefId = pickId(payload, "briefId", "id");
    if (!briefId || !ctx.user?.id) return false;
    const capabilities = await getBriefCapabilities(
      { userId: ctx.user.id, companyId: ctx.user.companyId, platformRole: ctx.user.role },
      briefId,
    );
    return capabilities.canOpenBrief;
  },

  /** Brief content is visible only through an explicit active grant. */
  isOwnBriefOrCollaborator: async (ctx, payload) => {
    const briefId = pickId(payload, "briefId", "id");
    if (!briefId || !ctx.user?.id) return false;
    const capabilities = await getBriefCapabilities(
      { userId: ctx.user.id, companyId: ctx.user.companyId, platformRole: ctx.user.role },
      briefId,
    );
    return capabilities.canOpenBrief;
  },

  /** Brief edit access is reserved for an Editor grant. */
  isEditingCollaborator: async (ctx, payload) => {
    const briefId = pickId(payload, "briefId", "id");
    if (!briefId || !ctx.user?.id) return false;
    const capabilities = await getBriefCapabilities(
      { userId: ctx.user.id, companyId: ctx.user.companyId, platformRole: ctx.user.role },
      briefId,
    );
    return capabilities.canEditBrief;
  },

  /** ctx.user.companyId == match.partnerId. */
  isMatchedPartner: async (ctx, payload) => {
    const matchId = pickId(payload, "matchId", "id");
    if (!matchId || !ctx.user?.companyId) return false;
    const m = await queryOne<{ partnerId: string }>(
      'SELECT "partnerId" FROM "Match" WHERE "id" = $1',
      [matchId],
    );
    return Boolean(m && m.partnerId === ctx.user.companyId);
  },

  /** isMatchedPartner AND match.status ∈ {SOURCED, INVITED, PARTNER_ACCEPTED}. */
  isInvitedPartner: async (ctx, payload) => {
    const matchId = pickId(payload, "matchId", "id");
    if (!matchId || !ctx.user?.companyId) return false;
    const m = await queryOne<{ partnerId: string; status: string }>(
      'SELECT "partnerId", "status" FROM "Match" WHERE "id" = $1',
      [matchId],
    );
    if (!m) return false;
    return (
      m.partnerId === ctx.user.companyId &&
      (m.status === "SOURCED" || m.status === "INVITED" || m.status === "PARTNER_ACCEPTED")
    );
  },

  /** ctx.user.id == payload.userId (or omitted == self). */
  isOwnUser: (ctx, payload) => {
    const uid = pickId(payload, "userId");
    if (!uid) return Boolean(ctx.user?.id);
    return ctx.user?.id === uid;
  },

  /** ctx.user.companyId == payload.companyId. */
  isOwnCompany: (ctx, payload) => {
    const cid = pickId(payload, "companyId");
    if (!cid) return Boolean(ctx.user?.companyId);
    return Boolean(ctx.user?.companyId && ctx.user.companyId === cid);
  },

  /** Partner has accepted the platform T&Cs. */
  isAcceptedTerms: async (ctx) => {
    if (!ctx.user?.companyId) return false;
    const profile = await queryOne<{ acceptedTermsAt: Date | null }>(
      'SELECT "acceptedTermsAt" FROM "PartnerProfile" WHERE "companyId" = $1',
      [ctx.user.companyId],
    );
    return Boolean(profile?.acceptedTermsAt);
  },

  /**
   * Sensitive-action gate: a `SecondaryApproval` row exists, is
   * approved, hasn't expired, and references the resource at hand.
   * Today this returns `false` until that model lands; admins can
   * bypass via a feature flag in dev.
   */
  secondaryApproval: () => {
    // TODO: Wire to SecondaryApproval model in Phase 2 of Track C.
    return false;
  },
};

function pickId(payload: Payload, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = payload?.[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export function getCondition(key: ConditionKey) {
  return conditions[key];
}
