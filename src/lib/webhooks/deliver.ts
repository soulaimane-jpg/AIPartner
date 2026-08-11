/**
 * Webhook delivery worker.
 *
 * Invoked by `JOB_HANDLERS["webhook.deliver"]` with a `{ deliveryId }`
 * payload. Loads the row, signs the body, fires the HTTP request, and
 * records the outcome on the same row.
 *
 * Retry policy mirrors `JobRun`: throwing from the handler lets the
 * job runner schedule the next attempt with exponential backoff, and
 * the runner stops at `maxAttempts`. We also flip the row to
 * `failed`/`dlq` so the admin UI can show terminal state without
 * needing to join JobRun.
 *
 * Network discipline:
 *   - 10 second hard timeout.
 *   - 4KB cap on response body we persist (rest is dropped — we keep
 *     just enough for "what did the consumer say?").
 *   - User-Agent and signature headers are always set; consumers can
 *     pin on `User-Agent: AIPartner-Webhook/1.0`.
 *   - Auto-disable an endpoint after 20 consecutive failures (status
 *     flips to `disabled`); operator must re-enable explicitly.
 */

import "server-only";
import { queryOne, tx } from "@/lib/db";
import type { WebhookDeliveryRow, WebhookEndpointRow } from "@/lib/db/rows";
import { signWebhookBody } from "./signature";

const MAX_RESPONSE_BYTES = 4_096;
const REQUEST_TIMEOUT_MS = 10_000;
const AUTO_DISABLE_AFTER = 20;

export async function deliverWebhook(deliveryId: string): Promise<void> {
  const deliveryRow = await queryOne<WebhookDeliveryRow>(
    'SELECT * FROM "WebhookDelivery" WHERE "id" = $1',
    [deliveryId],
  );
  if (!deliveryRow) {
    // Already purged or never existed; treat as success so we don't retry.
    return;
  }
  const endpoint = await queryOne<WebhookEndpointRow>(
    'SELECT * FROM "WebhookEndpoint" WHERE "id" = $1',
    [deliveryRow.endpointId],
  );
  if (!endpoint) return;
  const delivery = { ...deliveryRow, endpoint };
  if (delivery.status === "success") return;
  if (delivery.endpoint.status !== "active") {
    // Endpoint was paused/disabled after we enqueued — abandon quietly.
    await queryOne(
      `UPDATE "WebhookDelivery" SET "status" = 'failed', "errorMessage" = $2,
         "deliveredAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      [delivery.id, `endpoint-${delivery.endpoint.status}`],
    );
    return;
  }

  const attempt = delivery.attempt + 1;
  const signed = signWebhookBody(delivery.endpoint.secret, delivery.payload);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let responseCode = 0;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AIPartner-Webhook/1.0",
        "X-AIPartner-Event": delivery.event,
        "X-AIPartner-Delivery": delivery.id,
        "X-AIPartner-Signature": signed.header,
        "X-AIPartner-Timestamp": String(signed.timestamp),
      },
      body: delivery.payload,
      signal: ctrl.signal,
      // Hard-redirect rejection: consumers should not 3xx webhooks.
      redirect: "manual",
      cache: "no-store",
    });
    responseCode = res.status;
    const text = await res.text().catch(() => "");
    responseBody = text.slice(0, MAX_RESPONSE_BYTES);
    if (!res.ok) {
      errorMessage = `http-${res.status}`;
    }
  } catch (err) {
    errorMessage =
      err instanceof Error ? err.name === "AbortError" ? "timeout" : err.message : "network-error";
  } finally {
    clearTimeout(timer);
  }

  const isTerminalSuccess = responseCode >= 200 && responseCode < 300 && !errorMessage;
  const isLastAttempt = attempt >= delivery.maxAttempts;

  if (isTerminalSuccess) {
    await tx(async (client) => {
      await client.query(
        `UPDATE "WebhookDelivery" SET "status" = 'success', "attempt" = $2,
           "responseCode" = $3, "responseBody" = $4, "errorMessage" = NULL,
           "deliveredAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $1`,
        [delivery.id, attempt, responseCode, responseBody],
      );
      await client.query(
        `UPDATE "WebhookEndpoint" SET "lastDeliveryAt" = NOW(),
           "lastSuccessAt" = NOW(), "consecutiveFails" = 0, "updatedAt" = NOW()
         WHERE "id" = $1`,
        [delivery.endpoint.id],
      );
    });
    return;
  }

  // Failure path — record + decide whether to retry or DLQ.
  const nextStatus = isLastAttempt ? "dlq" : "pending";
  const newConsecutive = delivery.endpoint.consecutiveFails + 1;
  const shouldDisable = newConsecutive >= AUTO_DISABLE_AFTER;

  await tx(async (client) => {
    await client.query(
      `UPDATE "WebhookDelivery" SET "status" = $2, "attempt" = $3,
         "responseCode" = $4, "responseBody" = $5, "errorMessage" = $6,
         "deliveredAt" = $7, "updatedAt" = NOW()
       WHERE "id" = $1`,
      [
        delivery.id,
        nextStatus,
        attempt,
        responseCode || null,
        responseBody,
        errorMessage,
        isLastAttempt ? new Date() : null,
      ],
    );
    await client.query(
      `UPDATE "WebhookEndpoint" SET "lastDeliveryAt" = NOW(),
         "lastFailureAt" = NOW(), "consecutiveFails" = $2, "status" = $3, "updatedAt" = NOW()
       WHERE "id" = $1`,
      [
        delivery.endpoint.id,
        newConsecutive,
        shouldDisable ? "disabled" : delivery.endpoint.status,
      ],
    );
  });

  // Throwing tells the job runner to schedule a retry. On the final
  // attempt the runner moves the JobRun to `dlq` itself; we still
  // throw so the audit trail captures the last error.
  if (!isLastAttempt) {
    throw new Error(errorMessage ?? `http-${responseCode}`);
  }
}
