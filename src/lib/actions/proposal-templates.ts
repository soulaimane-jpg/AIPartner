"use server";

/**
 * Proposal templates — partner-scoped reusable skeletons.
 *
 * Lifecycle:
 *   - `upsertProposalTemplateAction` — create / rename / re-rank.
 *   - `deleteProposalTemplateAction` — drop a template.
 *   - `applyProposalTemplateAction`   — given (templateId, briefId)
 *     submits a draft Proposal pre-filled from the template body.
 *
 * The `body` JSON is intentionally the same shape as
 * `SubmitProposalInput` (minus `briefId`). That symmetry lets the
 * picker render a one-click "apply" without parsing the template
 * client-side.
 *
 * Authorisation: ctx.user.companyId must match `Company.id`. Admin
 * over-ride goes through the partner-ops admin path, not this one.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, exec, insertRow, updateRows } from "@/lib/db";
import type { ProposalTemplateRow } from "@/lib/db/rows";

/** Same shape as `SubmitProposalInput` minus the `briefId`. */
const TemplateBody = z.object({
  summary: z.string().min(5),
  approach: z.string().min(5).optional(),
  timelineWeeks: z.coerce.number().int().positive(),
  totalCost: z.coerce.number().int().nonnegative(),
  strengths: z.array(z.string()).default([]),
  team: z
    .array(
      z.object({
        role: z.string().min(1),
        seniority: z.string().optional(),
        count: z.coerce.number().int().positive().default(1),
      }),
    )
    .default([]),
});

// ─── Upsert ──────────────────────────────────────────────────────

const UpsertTemplateInput = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).optional(),
  rank: z.coerce.number().int().min(0).max(10_000).optional(),
  body: TemplateBody,
});

export const upsertProposalTemplateAction = defineAction({
  name: "partner.proposal-template.upsert",
  input: UpsertTemplateInput,
  output: z.object({ id: z.string() }),
  permission: "partner.profile.update",
  rateLimit: {
    scope: "partner.proposal-template.upsert",
    limit: 30,
    windowSec: 60,
  },
  handler: async ({ id, label, description, rank, body }, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Partner company required" });
    }
    const companyId = ctx.user!.companyId!;

    if (id) {
      const existing = await queryOne<ProposalTemplateRow>(
        'SELECT * FROM "ProposalTemplate" WHERE "id" = $1',
        [id],
      );
      if (!existing || existing.companyId !== companyId) {
        fail({ code: "NOT_FOUND", resource: "ProposalTemplate" });
      }
      const [row] = await updateRows<{ id: string }>(
        "ProposalTemplate",
        { id },
        {
          label,
          description: description ?? null,
          rank: rank ?? existing!.rank,
          body: JSON.stringify(body),
        },
      );
      revalidatePath("/partner");
      return { id: row.id };
    }

    const row = await insertRow<{ id: string }>("ProposalTemplate", {
      companyId,
      label,
      description: description ?? null,
      rank: rank ?? 100,
      body: JSON.stringify(body),
    });
    revalidatePath("/partner");
    return { id: row.id };
  },
});

// ─── Delete ──────────────────────────────────────────────────────

const DeleteTemplateInput = z.object({
  id: z.string().min(1),
});

export const deleteProposalTemplateAction = defineAction({
  name: "partner.proposal-template.delete",
  input: DeleteTemplateInput,
  permission: "partner.profile.update",
  rateLimit: {
    scope: "partner.proposal-template.delete",
    limit: 30,
    windowSec: 60,
  },
  handler: async ({ id }, ctx) => {
    const existing = await queryOne<{ id: string; companyId: string }>(
      'SELECT "id", "companyId" FROM "ProposalTemplate" WHERE "id" = $1',
      [id],
    );
    if (!existing || existing.companyId !== ctx.user!.companyId) {
      fail({ code: "NOT_FOUND", resource: "ProposalTemplate" });
    }
    await exec('DELETE FROM "ProposalTemplate" WHERE "id" = $1', [id]);
    revalidatePath("/partner");
    return { ok: true as const };
  },
});

// ─── Apply ───────────────────────────────────────────────────────

const ApplyTemplateInput = z.object({
  templateId: z.string().min(1),
  briefId: z.string().min(1),
});

export const applyProposalTemplateAction = defineAction({
  name: "partner.proposal-template.apply",
  input: ApplyTemplateInput,
  output: TemplateBody,
  permission: "proposal.create",
  rateLimit: {
    scope: "partner.proposal-template.apply",
    limit: 30,
    windowSec: 60,
  },
  handler: async ({ templateId, briefId }, ctx) => {
    const template = await queryOne<ProposalTemplateRow>(
      'SELECT * FROM "ProposalTemplate" WHERE "id" = $1',
      [templateId],
    );
    if (!template || template.companyId !== ctx.user!.companyId) {
      fail({ code: "NOT_FOUND", resource: "ProposalTemplate" });
    }
    // Confirm match exists so the partner is actually invited.
    const match = await queryOne<{ id: string }>(
      'SELECT "id" FROM "Match" WHERE "briefId" = $1 AND "partnerId" = $2 LIMIT 1',
      [briefId, ctx.user!.companyId!],
    );
    if (!match) {
      fail({ code: "FORBIDDEN", reason: "Not assigned to this brief." });
    }

    let body: unknown;
    try {
      body = JSON.parse(template!.body);
    } catch {
      fail({
        code: "INTERNAL",
        traceId: "proposal-template.body-not-json",
      });
    }
    const parsed = TemplateBody.safeParse(body);
    if (!parsed.success) {
      fail({
        code: "INTERNAL",
        traceId: "proposal-template.body-schema-drift",
      });
    }
    return parsed!.data;
  },
});

// ─── Server-side reader ─────────────────────────────────────────

export async function listProposalTemplates(companyId: string) {
  return query<ProposalTemplateRow>(
    `SELECT * FROM "ProposalTemplate"
     WHERE "companyId" = $1
     ORDER BY "rank" ASC, "createdAt" DESC`,
    [companyId],
  );
}
