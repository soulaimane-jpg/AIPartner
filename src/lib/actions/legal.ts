"use server";

/**
 * Legal gate Server Actions — plan-A M1.
 *
 * - `acceptLegalDocumentsAction` — user accepts the current version(s)
 *   blocking them at the gate. Audit-logged via defineAction.
 * - `publishLegalDocumentAction` — admin uploads/replaces text and
 *   publishes a new version (re-triggers the gate for everyone).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query } from "@/lib/db";
import {
  LEGAL_DOC_TYPES,
  publishNewVersion,
  recordAcceptance,
} from "@/lib/legal/documents";

const AcceptLegalInput = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(10),
  /** Typed-name e-signature (optional at the login gate). */
  acceptedName: z.string().max(200).optional(),
});

export const acceptLegalDocumentsAction = defineAction({
  name: "legal.accept",
  input: AcceptLegalInput,
  output: z.object({ accepted: z.number() }),
  permission: "legal.accept",
  rateLimit: { scope: "legal.accept", limit: 20, windowSec: 60 },
  handler: async ({ documentIds, acceptedName }, ctx) => {
    const docs = await query<{ id: string }>(
      `SELECT "id" FROM "LegalDocument" WHERE "id" = ANY($1) AND "status" = 'published'`,
      [documentIds],
    );
    if (docs.length !== documentIds.length) {
      fail({ code: "NOT_FOUND", resource: "LegalDocument" });
    }

    for (const doc of docs) {
      await recordAcceptance({
        documentId: doc.id,
        userId: ctx.user!.id,
        companyId: ctx.user!.companyId ?? null,
        acceptedName: acceptedName ?? null,
        ipHash: ctx.ipHash ?? null,
        userAgent: ctx.userAgent ?? null,
      });
    }

    revalidatePath("/legal/accept");
    return { accepted: docs.length };
  },
});

const PublishLegalInput = z.object({
  docType: z.enum(LEGAL_DOC_TYPES),
  title: z.string().min(3).max(500),
  body: z.string().min(10),
});

export const publishLegalDocumentAction = defineAction({
  name: "admin.legal.publish",
  input: PublishLegalInput,
  output: z.object({ id: z.string(), version: z.number() }),
  permission: "admin.legal.manage",
  rateLimit: { scope: "admin.legal.publish", limit: 10, windowSec: 60 },
  handler: async ({ docType, title, body }, ctx) => {
    const doc = await publishNewVersion({
      docType,
      title,
      body,
      publishedBy: ctx.user!.id,
    });
    revalidatePath("/admin/legal");
    return { id: doc.id, version: doc.version };
  },
});
