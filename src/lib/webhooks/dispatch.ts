/**
 * Webhook fan-out — the only function the rest of the codebase calls.
 *
 * Lifecycle:
 *   1. Caller does `await dispatchWebhook("brief.submitted", { briefId, ... })`
 *      from a Server Action *after* the relevant transaction has
 *      committed. We never fan-out inside an open transaction —
 *      doing so risks delivering an event for state that gets rolled
 *      back.
 *   2. We resolve which `WebhookEndpoint` rows want this event (each
 *      row's `events` array — empty == subscribe-all). We scope the
 *      lookup to the resource's owning company so a partner can only
 *      receive their own events.
 *   3. For each match we persist a `WebhookDelivery` row in `pending`
 *      state with `attempt = 0` and the JSON payload exactly as it
 *      will be signed. This is the durability cliff — once persisted,
 *      the worker owns delivery.
 *   4. We enqueue a `webhook.deliver` job per delivery (idempotent on
 *      delivery id). The job runner picks them up on the next cron
 *      tick (≤ 60s by default).
 *
 * Why DB-then-queue instead of inline HTTP:
 *   - Inline HTTP blocks the user response on third-party latency.
 *   - Inline HTTP can't survive a process restart between "saw event"
 *     and "delivered".
 *   - The delivery row is the audit trail consumers expect ("you sent
 *     me X at Y, here's my response").
 */

import "server-only";
import { query, insertRow } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import type { WebhookEvent } from "./events";

export interface DispatchOptions {
  /**
   * Which company's endpoints should receive the event. Most events
   * are scoped to a single tenant — pass `companyId` explicitly so
   * we never accidentally cross-deliver.
   *
   * `companyIds` (plural) lets us fan-out to several tenants for
   * multi-party events (e.g. `proposal.received` notifies both the
   * customer and the partner).
   */
  companyIds: string[];
  /** Free-form correlation id, threaded into delivery rows for tracing. */
  requestId?: string;
}

export interface DispatchResult {
  matched: number;
  enqueued: number;
}

const DELIVERY_JOB = "webhook.deliver";

/**
 * Persist + enqueue webhook deliveries. Returns the count of endpoints
 * that matched and the count of jobs enqueued.
 */
export async function dispatchWebhook(
  eventName: WebhookEvent,
  payload: Record<string, unknown>,
  options: DispatchOptions,
): Promise<DispatchResult> {
  const tenants = Array.from(new Set(options.companyIds.filter(Boolean)));
  if (tenants.length === 0) {
    return { matched: 0, enqueued: 0 };
  }

  const endpoints = await query<{ id: string; events: string | null }>(
    `SELECT "id", "events" FROM "WebhookEndpoint"
     WHERE "companyId" = ANY($1) AND "status" = 'active'`,
    [tenants],
  );

  // Filter to endpoints that subscribe to this event (or all events).
  const targets = endpoints.filter((e) => {
    if (!e.events || e.events === "[]") return true; // subscribe-all
    try {
      const list = JSON.parse(e.events) as string[];
      return list.length === 0 || list.includes(eventName);
    } catch {
      return false;
    }
  });

  if (targets.length === 0) {
    return { matched: 0, enqueued: 0 };
  }

  const wirePayload = JSON.stringify({
    id: cryptoRandomId(),
    type: eventName,
    createdAt: new Date().toISOString(),
    data: payload,
  });

  let enqueuedCount = 0;
  for (const t of targets) {
    const delivery = await insertRow<{ id: string }>("WebhookDelivery", {
      endpointId: t.id,
      event: eventName,
      payload: wirePayload,
      status: "pending",
      attempt: 0,
      scheduledFor: new Date(),
    });
    const { deduped } = await enqueue(
      DELIVERY_JOB,
      { deliveryId: delivery.id },
      {
        idemKey: `delivery:${delivery.id}`,
        requestId: options.requestId,
      },
    );
    if (!deduped) enqueuedCount += 1;
  }

  return { matched: targets.length, enqueued: enqueuedCount };
}

/**
 * Edge-safe random id (no `node:crypto` import — keeps this module
 * importable from the dispatch path even when the call-site is itself
 * compiled into a thin runtime).
 */
function cryptoRandomId(): string {
  const a = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
