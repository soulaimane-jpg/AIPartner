import "server-only";

import { query, queryOne } from "@/lib/db";
import { emailDomain, isGenericEmailDomain } from "@/lib/partner-verification";

/**
 * Find the workspace a new signup probably belongs to.
 *
 * Matching is on the email domain of *verified* existing members only:
 * an unverified account proves nothing about who controls the domain,
 * and using it would let one bad signup poison the suggestion for
 * everyone who follows.
 *
 * Free-mail domains are excluded outright — `@gmail.com` is not an
 * organisation.
 */
export interface WorkspaceCandidate {
  companyId: string;
  companyName: string;
  domain: string;
  /** Verified members already in that workspace. */
  memberCount: number;
}

export async function findWorkspaceByEmailDomain(
  email: string,
): Promise<WorkspaceCandidate | null> {
  const domain = emailDomain(email);
  if (!domain || isGenericEmailDomain(domain)) return null;

  // Most-populated matching workspace wins: with two candidates the
  // larger one is far more likely to be the real organisation.
  const row = await queryOne<{
    companyId: string;
    companyName: string;
    memberCount: number;
  }>(
    `SELECT c."id" AS "companyId", c."name" AS "companyName",
            COUNT(u."id")::int AS "memberCount"
       FROM "User" u
       JOIN "Company" c ON c."id" = u."companyId"
      WHERE c."kind" = 'CUSTOMER'
        AND u."emailVerified" IS NOT NULL
        AND lower(split_part(u."email", '@', 2)) = $1
      GROUP BY c."id", c."name"
      ORDER BY COUNT(u."id") DESC
      LIMIT 1`,
    [domain],
  );
  if (!row) return null;

  return {
    companyId: row.companyId,
    companyName: row.companyName,
    domain,
    memberCount: row.memberCount,
  };
}

export interface PendingJoinRequest {
  id: string;
  requesterId: string;
  requesterName: string | null;
  requesterEmail: string;
  emailDomain: string;
  createdAt: Date;
}

/** Pending requests to join a workspace, for the members screen. */
export async function listPendingJoinRequests(
  companyId: string,
): Promise<PendingJoinRequest[]> {
  return query<PendingJoinRequest>(
    `SELECT r."id", r."requesterId", r."emailDomain", r."createdAt",
            u."name" AS "requesterName", u."email" AS "requesterEmail"
       FROM "WorkspaceJoinRequest" r
       JOIN "User" u ON u."id" = r."requesterId"
      WHERE r."companyId" = $1 AND r."status" = 'PENDING'
      ORDER BY r."createdAt" ASC`,
    [companyId],
  );
}
