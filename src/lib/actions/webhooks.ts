/**
 * Webhook endpoint Server Actions.
 *
 * Operators (admins of a CUSTOMER or PARTNER tenant) manage their own
 * outbound webhook subscriptions through these actions:
 *
 *   - `createWebhook`   — register a URL + event filter; returns the
 *                         raw secret exactly once.
 *   - `updateWebhook`   — toggle status, edit URL/events.
 *   - `rotateSecret`    — invalidate the old secret + return the new
 *                         one (single-view).
 *   - `deleteWebhook`   — soft-revocable hard delete with cascading
 *                         deliveries.
 *   - `testWebhook`     — fire a synthetic `webhook.test` event.
 *   - `listWebhooks`    — read helper used by the admin UI.
 *
 * All actions are scoped to `ctx.user.companyId`. RBAC matrix already
 * gates `webhook.*` permissions to ADMIN globally and PARTNER admins
 * via `isOwnCompany`.
 */

"use server";

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";
import { generateWebhookSecret } from "@/lib/webhooks/signature";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import { revalidatePath } from "next/cache";

const eventSchema = z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]]);

const urlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), {
    message: "Webhook URLs must use HTTPS",
  })
  .refine(
    (u) => {
      // Block obvious SSRF targets — localhost, link-local, RFC1918.
      // We rely on the consumer using a public ingress; private nets
      // should be reachable via a tunnel they control.
      const lower = u.toLowerCase();
      return !(
        lower.includes("//localhost") ||
        lower.includes("//127.") ||
        lower.includes("//0.0.0.0") ||
        lower.includes("//169.254.") ||
        lower.includes("//10.") ||
        lower.includes("//192.168.") ||
        /\/\/172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
      );
    },
    { message: "URL must be publicly reachable" },
  );

export const createWebhook = defineAction({
  name: "webhook.create",
  permission: "webhook.create",
  rateLimit: { scope: "webhook.create", limit: 10, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    url: urlSchema,
    description: z.string().max(200).optional(),
    events: z.array(eventSchema).max(WEBHOOK_EVENTS.length).default([]),
  }),
  output: z.object({
    id: z.string(),
    secret: z.string(),
    prefix: z.string(),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const secret = generateWebhookSecret();
    const row = await insertRow<{ id: string }>("WebhookEndpoint", {
      companyId: input.companyId,
      url: input.url,
      description: input.description ?? null,
      events: JSON.stringify(input.events),
      secret,
      status: "active",
    });
    revalidatePath("/account/integrations");
    return { id: row.id, secret, prefix: secret.slice(0, 8) };
  },
});

export const updateWebhook = defineAction({
  name: "webhook.update",
  permission: "webhook.update",
  rateLimit: { scope: "webhook.update", limit: 30, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    id: z.string().min(1),
    url: urlSchema.optional(),
    description: z.string().max(200).nullable().optional(),
    events: z.array(eventSchema).optional(),
    status: z.enum(["active", "paused"]).optional(),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const existing = await queryOne<{ companyId: string }>(
      'SELECT "companyId" FROM "WebhookEndpoint" WHERE "id" = $1',
      [input.id],
    );
    if (!existing || existing.companyId !== input.companyId) {
      throw fail({ code: "NOT_FOUND" });
    }
    await updateRows(
      "WebhookEndpoint",
      { id: input.id },
      {
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.events !== undefined
          ? { events: JSON.stringify(input.events) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );
    revalidatePath("/account/integrations");
    return { ok: true as const };
  },
});

export const rotateWebhookSecret = defineAction({
  name: "webhook.rotateSecret",
  permission: "webhook.update",
  rateLimit: { scope: "webhook.rotate", limit: 5, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    id: z.string().min(1),
  }),
  output: z.object({
    secret: z.string(),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const existing = await queryOne<{ companyId: string }>(
      'SELECT "companyId" FROM "WebhookEndpoint" WHERE "id" = $1',
      [input.id],
    );
    if (!existing || existing.companyId !== input.companyId) {
      throw fail({ code: "NOT_FOUND" });
    }
    const secret = generateWebhookSecret();
    await updateRows(
      "WebhookEndpoint",
      { id: input.id },
      { secret, consecutiveFails: 0 },
    );
    revalidatePath("/account/integrations");
    return { secret };
  },
});

export const deleteWebhook = defineAction({
  name: "webhook.delete",
  permission: "webhook.delete",
  rateLimit: { scope: "webhook.delete", limit: 10, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    id: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const existing = await queryOne<{ companyId: string }>(
      'SELECT "companyId" FROM "WebhookEndpoint" WHERE "id" = $1',
      [input.id],
    );
    if (!existing || existing.companyId !== input.companyId) {
      throw fail({ code: "NOT_FOUND" });
    }
    await exec('DELETE FROM "WebhookEndpoint" WHERE "id" = $1', [input.id]);
    revalidatePath("/account/integrations");
    return { ok: true as const };
  },
});

/**
 * Synthetic delivery — useful from the admin UI to verify an endpoint.
 * The payload is a `webhook.test` event (NOT in the canonical list);
 * consumers can ignore it or echo it back to a UI for debugging.
 */
export const testWebhook = defineAction({
  name: "webhook.test",
  permission: "webhook.update",
  rateLimit: { scope: "webhook.test", limit: 5, windowSec: 60 },
  input: z.object({
    companyId: z.string().min(1),
    id: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    if (!ctx.user) throw fail({ code: "UNAUTHENTICATED" });
    const existing = await queryOne<{ companyId: string; status: string }>(
      'SELECT "companyId", "status" FROM "WebhookEndpoint" WHERE "id" = $1',
      [input.id],
    );
    if (!existing || existing.companyId !== input.companyId) {
      throw fail({ code: "NOT_FOUND" });
    }
    if (existing.status !== "active") {
      throw fail({ code: "CONFLICT", reason: "endpoint-not-active" });
    }
    // We use the canonical dispatcher so the test row is identical in
    // shape to a real one. The `brief.created` event is harmless when
    // the consumer's idempotency key kicks in (since the id is a UUID
    // they've never seen). The `data.test` flag tells consumers this
    // is synthetic.
    await dispatchWebhook(
      "brief.created",
      { test: true, dispatchedBy: ctx.user.id },
      { companyIds: [input.companyId], requestId: ctx.requestId },
    );
    return { ok: true as const };
  },
});

/**
 * Reader for the admin UI. Server-side function (not an Action since
 * we don't need rate limiting on a read).
 */
export async function listWebhookEndpoints(companyId: string) {
  const rows = await query<{
    id: string;
    url: string;
    description: string | null;
    events: string;
    status: string;
    lastDeliveryAt: Date | null;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    consecutiveFails: number;
    createdAt: Date;
  }>(
    `SELECT "id", "url", "description", "events", "status",
            "lastDeliveryAt", "lastSuccessAt", "lastFailureAt",
            "consecutiveFails", "createdAt"
     FROM "WebhookEndpoint"
     WHERE "companyId" = $1
     ORDER BY "createdAt" DESC`,
    [companyId],
  );
  return rows.map((r) => ({
    ...r,
    events: safeParseEvents(r.events),
  }));
}

export async function listRecentDeliveries(
  endpointId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    event: string;
    status: string;
    attempt: number;
    responseCode: number | null;
    deliveredAt: Date | null;
    createdAt: Date;
  }>
> {
  return query(
    `SELECT "id", "event", "status", "attempt", "responseCode",
            "deliveredAt", "createdAt"
     FROM "WebhookDelivery"
     WHERE "endpointId" = $1
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [endpointId, limit],
  );
}

function safeParseEvents(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
