import "server-only";

import { queryOne } from "@/lib/db";

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const BRIEF_ACCESS_ROLES = ["EDITOR", "VIEWER"] as const;
export type BriefAccessRole = (typeof BRIEF_ACCESS_ROLES)[number];

export type BriefCapabilities = {
  exists: boolean;
  isWorkspaceMember: boolean;
  workspaceRole: WorkspaceRole | null;
  briefRole: BriefAccessRole | null;
  canSeeMetadata: boolean;
  canOpenBrief: boolean;
  canEditBrief: boolean;
  canManageAccess: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  canSelfGrant: boolean;
};

type BriefAccessSubject = {
  userId: string;
  companyId: string | null;
  platformRole?: string;
};

export async function getBriefCapabilities(
  subject: BriefAccessSubject,
  briefId: string,
): Promise<BriefCapabilities> {
  if (subject.platformRole === "ADMIN") return allCapabilities();

  const row = await queryOne<{
    briefId: string;
    ownerId: string;
    companyId: string;
    workspaceRole: string | null;
    workspaceStatus: string | null;
    briefRole: string | null;
    briefStatus: string | null;
    legacyRole: string | null;
  }>(
    `SELECT b."id" AS "briefId", b."ownerId", b."companyId",
            wm."role" AS "workspaceRole", wm."status" AS "workspaceStatus",
            ba."role" AS "briefRole", ba."status" AS "briefStatus",
            bc."role" AS "legacyRole"
     FROM "ProjectBrief" b
     LEFT JOIN "WorkspaceMembership" wm
       ON wm."companyId" = b."companyId" AND wm."userId" = $2 AND wm."status" = 'ACTIVE'
     LEFT JOIN "BriefAccess" ba
       ON ba."briefId" = b."id" AND ba."userId" = $2 AND ba."status" = 'ACTIVE'
     LEFT JOIN "BriefCollaborator" bc
       ON bc."briefId" = b."id" AND bc."userId" = $2 AND bc."status" = 'ACTIVE'
     WHERE b."id" = $1`,
    [briefId, subject.userId],
  );

  if (!row) return noCapabilities();

  const isCreator = row.ownerId === subject.userId;
  const isWorkspaceMember = row.workspaceStatus === "ACTIVE";
  const workspaceRole = asWorkspaceRole(row.workspaceRole);
  const briefRole = isCreator
    ? "EDITOR"
    : asBriefRole(row.briefRole) ?? asBriefRole(row.legacyRole);
  const isAdmin = workspaceRole === "OWNER" || workspaceRole === "ADMIN";
  const canOpenBrief = isCreator || briefRole !== null;
  const canEditBrief = isCreator || briefRole === "EDITOR";

  return {
    exists: true,
    isWorkspaceMember,
    workspaceRole,
    briefRole,
    canSeeMetadata: isWorkspaceMember || canOpenBrief,
    canOpenBrief,
    canEditBrief,
    canManageAccess: canEditBrief || isAdmin,
    canApprove: briefRole === "EDITOR",
    canSubmit: canEditBrief,
    canSelfGrant: isAdmin && !canOpenBrief,
  };
}

export async function hasOutstandingApprovals(briefId: string): Promise<boolean> {
  const row = await queryOne<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM "BriefAccess" ba
       JOIN "ProjectBrief" b ON b."id" = ba."briefId"
       WHERE ba."briefId" = $1 AND ba."role" = 'EDITOR' AND ba."status" = 'ACTIVE'
         AND ba."approvedAt" IS NULL AND ba."userId" <> b."ownerId"
       UNION ALL
       SELECT 1 FROM "BriefCollaborator" bc
       JOIN "ProjectBrief" b ON b."id" = bc."briefId"
       WHERE bc."briefId" = $1 AND bc."role" = 'EDITOR' AND bc."status" <> 'REMOVED'
         AND bc."approvedAt" IS NULL AND bc."email" <> (
           SELECT u."email" FROM "User" u WHERE u."id" = b."ownerId"
         )
     ) AS blocked`,
    [briefId],
  );
  return row?.blocked ?? false;
}

function asWorkspaceRole(value: string | null): WorkspaceRole | null {
  return WORKSPACE_ROLES.includes(value as WorkspaceRole) ? (value as WorkspaceRole) : null;
}

function asBriefRole(value: string | null): BriefAccessRole | null {
  return BRIEF_ACCESS_ROLES.includes(value as BriefAccessRole) ? (value as BriefAccessRole) : null;
}

function noCapabilities(): BriefCapabilities {
  return {
    exists: false,
    isWorkspaceMember: false,
    workspaceRole: null,
    briefRole: null,
    canSeeMetadata: false,
    canOpenBrief: false,
    canEditBrief: false,
    canManageAccess: false,
    canApprove: false,
    canSubmit: false,
    canSelfGrant: false,
  };
}

function allCapabilities(): BriefCapabilities {
  return {
    exists: true,
    isWorkspaceMember: true,
    workspaceRole: "ADMIN",
    briefRole: "EDITOR",
    canSeeMetadata: true,
    canOpenBrief: true,
    canEditBrief: true,
    canManageAccess: true,
    canApprove: true,
    canSubmit: true,
    canSelfGrant: false,
  };
}
