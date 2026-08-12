"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { genId, insertRow, queryOne, tx } from "@/lib/db";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { getBriefCapabilities, BRIEF_ACCESS_ROLES } from "@/lib/workspace-access";

const RequestAccessInput = z.object({ briefId: z.string().min(8) });

export const requestBriefAccessAction = defineAction({
  name: "brief.access.request",
  input: RequestAccessInput,
  permission: null,
  rateLimit: { scope: "brief.access.request", limit: 10, windowSec: 300 },
  handler: async ({ briefId }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const capabilities = await getBriefCapabilities(
      {
        userId: ctx.user!.id,
        companyId: ctx.user!.companyId,
        platformRole: ctx.user!.role,
      },
      briefId,
    );
    if (!capabilities.exists || !capabilities.isWorkspaceMember) fail({ code: "NOT_FOUND", resource: "Brief" });
    if (capabilities.canOpenBrief) return { status: "already_granted" as const };

    const existing = await queryOne<{ id: string }>(
      `SELECT "id" FROM "BriefAccessRequest"
       WHERE "briefId" = $1 AND "requesterId" = $2 AND "status" = 'PENDING'`,
      [briefId, ctx.user!.id],
    );
    if (existing) return { status: "pending" as const };

    const targets = await tx(async (client) => {
      await insertRow(
        "BriefAccessRequest",
        { briefId, requesterId: ctx.user!.id, status: "PENDING" },
        { client },
      );
      const recipientsResult = await client.query<{ userId: string }>(
        `SELECT DISTINCT "userId" FROM "BriefAccess"
         WHERE "briefId" = $1 AND "status" = 'ACTIVE' AND "role" = 'EDITOR'`,
        [briefId],
      );
      const ownerResult = await client.query<{ ownerId: string; title: string }>(
        'SELECT "ownerId", "title" FROM "ProjectBrief" WHERE "id" = $1',
        [briefId],
      );
      const owner = ownerResult.rows[0] ?? null;
      const targetIds = new Set(recipientsResult.rows.map((row) => row.userId));
      if (owner) targetIds.add(owner.ownerId);
      return { targetIds: [...targetIds], title: owner?.title ?? "Project brief" };
    });

    // Outside the transaction: notifications enqueue email, and a mail
    // problem must not roll back the access request itself.
    await notify({
      event: "brief.access_requested",
      recipients: targets.targetIds.map((userId) => ({ userId })),
      vars: {
        requesterName: ctx.user!.name ?? ctx.user!.email ?? "A colleague",
        briefTitle: targets.title,
      },
      link: `/briefs/${briefId}/preview#access`,
      briefId,
    });
    await audit(ctx, { kind: "access_requested", targetType: "ProjectBrief", targetId: briefId });
    revalidatePath(`/briefs/${briefId}/preview`);
    return { status: "requested" as const };
  },
});

const GrantAccessInput = z.object({
  requestId: z.string().min(8),
  role: z.enum(BRIEF_ACCESS_ROLES),
});

export const grantBriefAccessAction = defineAction({
  name: "brief.access.grant",
  input: GrantAccessInput,
  permission: null,
  rateLimit: { scope: "brief.access.grant", limit: 30, windowSec: 60 },
  handler: async ({ requestId, role }, ctx) => {
    if (!ctx.user) fail({ code: "UNAUTHENTICATED" });
    const request = await queryOne<{ briefId: string; requesterId: string; status: string }>(
      'SELECT "briefId", "requesterId", "status" FROM "BriefAccessRequest" WHERE "id" = $1',
      [requestId],
    );
    if (!request || request.status !== "PENDING") fail({ code: "NOT_FOUND", resource: "Access request" });
    const capabilities = await getBriefCapabilities(
      { userId: ctx.user!.id, companyId: ctx.user!.companyId, platformRole: ctx.user!.role },
      request.briefId,
    );
    if (!capabilities.canManageAccess) fail({ code: "FORBIDDEN" });

    await tx(async (client) => {
      await client.query(
        `INSERT INTO "BriefAccess" ("id", "briefId", "userId", "role", "status", "grantedById", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, NOW(), NOW())
         ON CONFLICT ("briefId", "userId") DO UPDATE SET
           "role" = EXCLUDED."role", "status" = 'ACTIVE', "grantedById" = EXCLUDED."grantedById", "updatedAt" = NOW()`,
        [genId(), request.briefId, request.requesterId, role, ctx.user!.id],
      );
      await client.query(
        `UPDATE "BriefAccessRequest" SET "status" = 'GRANTED', "resolvedById" = $2, "resolvedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
        [requestId, ctx.user!.id],
      );
    });

    await notify({
      event: "brief.access_granted",
      recipients: [{ userId: request.requesterId }],
      vars: { role: role.toLowerCase() },
      link: `/briefs/${request.briefId}/preview`,
      briefId: request.briefId,
    });
    await audit(ctx, {
      kind: "access_granted",
      targetType: "ProjectBrief",
      targetId: request.briefId,
      payload: { userId: request.requesterId, role },
    });
    revalidatePath(`/briefs/${request.briefId}/preview`);
    return { ok: true as const };
  },
});
