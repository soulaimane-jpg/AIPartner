"use server";

/**
 * Data Subject Rights (GDPR / UK-GDPR) actions.
 *
 * Three kinds of request the user can submit themselves:
 *   - **export**  : we generate a JSON bundle of their data.
 *   - **erase**   : we tombstone their account + cascade-delete their
 *                   user-owned content; audit log preserved with
 *                   `actor → redacted:<hash>`.
 *   - **rectify** : free-text request describing the inaccuracy.
 *                   Fulfilled by an admin; cheap demand-side surface.
 *
 * Lifecycle is `queued → processing → complete | rejected`. The heavy
 * work runs in a background job (`lib/jobs/dsr.ts`), enqueued here so
 * fulfilment starts immediately rather than waiting on a sweep.
 *
 * Compliance SLA: 30 calendar days from request to completion (GDPR
 * Art. 12). The retention worker surfaces overdue requests to admin.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import { sendEmail } from "@/lib/email/provider";
import { enqueue } from "@/lib/jobs/queue";

const DsrKind = z.enum(["export", "erase", "rectify"]);

const SubmitDsrInput = z.object({
  kind: DsrKind,
  /** Free-text justification — required for rectify, optional otherwise. */
  notes: z.string().max(4000).optional(),
});

export const submitDsrRequestAction = defineAction({
  name: "dsr.submit",
  input: SubmitDsrInput,
  output: z.object({ id: z.string(), kind: DsrKind }),
  permission: "dsr.export", // present for every authenticated role
  rateLimit: { scope: "dsr.submit", limit: 5, windowSec: 86400 },
  handler: async ({ kind, notes }, ctx) => {
    if (kind === "rectify" && !notes?.trim()) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "notes",
            message:
              "Tell us what's inaccurate or out of date so we can fix it.",
          },
        ],
      });
    }

    // Refuse a duplicate active request — one-at-a-time is GDPR-clean.
    const active = await queryOne<{ id: string }>(
      `SELECT "id" FROM "DsrRequest"
       WHERE "userId" = $1 AND "kind" = $2 AND "status" IN ('queued', 'processing')
       LIMIT 1`,
      [ctx.user!.id, kind],
    );
    if (active) {
      fail({
        code: "CONFLICT",
        reason: "You already have a request of this kind in progress.",
      });
    }

    const row = await insertRow<{ id: string }>("DsrRequest", {
      userId: ctx.user!.id,
      kind,
      status: "queued",
      notes: notes?.trim() || null,
    });

    // Actually fulfil it. Until now this table was a queue with no
    // worker: requests were recorded, the 30-day statutory clock started,
    // and nothing ever completed one. `rectify` stays manual by design —
    // only a human can judge what is inaccurate — but it is surfaced to
    // admins so the deadline is visible.
    if (kind === "export" || kind === "erase") {
      await enqueue(
        kind === "export" ? "dsr.export" : "dsr.erase",
        { requestId: row.id },
        { idemKey: `dsr:${row.id}` },
      );
    }

    // Confirmation email to the user — never to the admins (privacy).
    await sendEmail({
      toAddress: ctx.user!.email,
      kind: "dsr",
      subject: `Your ${kind} request has been received`,
      body: [
        "Hi,",
        "",
        `We've received your data ${kind} request. Reference: ${row.id}.`,
        "",
        "We'll complete this within 30 days. You'll receive a follow-up email when it's done — sooner if we need anything from you.",
        "",
        "If you didn't make this request, contact security@aipartner.cloud immediately.",
        "",
        "— AI Partner",
      ].join("\n"),
    });

    revalidatePath("/account/security");
    return { id: row.id, kind };
  },
});

/**
 * Cancel a queued request the user changed their mind about. Once
 * processing has started this returns a CONFLICT — withdrawals are
 * handled by admin from then on.
 */
const CancelDsrInput = z.object({
  id: z.string().min(1),
});

export const cancelDsrRequestAction = defineAction({
  name: "dsr.cancel",
  input: CancelDsrInput,
  permission: "dsr.export",
  rateLimit: { scope: "dsr.cancel", limit: 10, windowSec: 600 },
  handler: async ({ id }, ctx) => {
    const row = await queryOne<{ id: string; userId: string; status: string }>(
      'SELECT "id", "userId", "status" FROM "DsrRequest" WHERE "id" = $1',
      [id],
    );
    if (!row || row.userId !== ctx.user!.id) {
      fail({ code: "NOT_FOUND", resource: "DsrRequest" });
    }
    if (row!.status !== "queued") {
      fail({
        code: "CONFLICT",
        reason: "This request is already in progress.",
      });
    }
    await updateRows(
      "DsrRequest",
      { id },
      { status: "rejected", completedAt: new Date(), notes: "Cancelled by user" },
    );
    revalidatePath("/account/security");
    return { ok: true as const };
  },
});
