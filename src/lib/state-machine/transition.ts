/**
 * Shared transition audit helper — plan-A §5 / §10.
 *
 * Every state transition (lead §5.1, invite §5.2, proposal §5.3) is
 * audit-logged with actor, from-state, to-state and timestamp. System
 * actions (timer expiries) log with `actorId = null` and
 * `payload.actor = "system"` so the trail distinguishes humans from
 * automation.
 */

import "server-only";
import type { PoolClient } from "pg";
import { insertRow } from "@/lib/db";
import { captureError } from "@/lib/observability";

export type TransitionActor =
  | { kind: "user"; userId: string; companyId?: string | null }
  | { kind: "system" };

export interface AuditTransitionOptions {
  actor: TransitionActor;
  /** Table name, e.g. "ProjectBrief", "Match", "Proposal". */
  entityType: string;
  entityId: string;
  /** Which machine — "lead" | "invite" | "proposal". */
  machine: string;
  from: string;
  to: string;
  reason?: string;
  meta?: Record<string, unknown>;
  /** Write the audit row inside the caller's transaction. */
  client?: PoolClient;
}

export async function auditTransition(
  opts: AuditTransitionOptions,
): Promise<void> {
  try {
    await insertRow(
      "AuditLog",
      {
        actorId: opts.actor.kind === "user" ? opts.actor.userId : null,
        kind: `transition.${opts.machine}`,
        targetId: opts.entityId,
        targetType: opts.entityType,
        companyId:
          opts.actor.kind === "user" ? (opts.actor.companyId ?? null) : null,
        payload: JSON.stringify({
          actor: opts.actor.kind === "system" ? "system" : opts.actor.userId,
          from: opts.from,
          to: opts.to,
          reason: opts.reason ?? null,
          ...(opts.meta ?? {}),
        }),
      },
      { noUpdatedAt: true, client: opts.client },
    );
  } catch (err) {
    // Audit must never break the transition. When the caller supplied a
    // transaction we must still rethrow, because swallowing here would
    // leave the surrounding transaction aborted-but-uncommitted and the
    // real error would surface later as a confusing COMMIT failure.
    if (opts.client) throw err;
    captureError(err, {
      scope: "transition",
      machine: opts.machine,
      from: opts.from,
      to: opts.to,
      entityId: opts.entityId,
    });
  }
}

export const SYSTEM_ACTOR: TransitionActor = { kind: "system" };

export function userActor(
  userId: string,
  companyId?: string | null,
): TransitionActor {
  return { kind: "user", userId, companyId: companyId ?? null };
}
