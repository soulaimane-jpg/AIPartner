/**
 * Sub-processor registry — admin Server Actions.
 *
 * Mutates the public `SubProcessor` table. All actions are admin-only
 * (see RBAC matrix). Public reads go through `lib/sub-processors.ts`
 * and `/api/v1/sub-processors` — those don't need a permission.
 *
 * Soft delete: `retireSubProcessor` flips `retiredAt`. We never hard
 * delete, because procurement audits frequently ask for the historical
 * sub-processor list at a given date.
 */

"use server";

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import { revalidatePath } from "next/cache";

const certificationsSchema = z
  .array(z.string().min(1).max(80))
  .max(20)
  .default([]);

export const createSubProcessor = defineAction({
  name: "subprocessor.create",
  permission: "subprocessor.create",
  rateLimit: { scope: "subprocessor.create", limit: 30, windowSec: 600 },
  input: z.object({
    name: z.string().trim().min(2).max(160),
    purpose: z.string().trim().min(2).max(400),
    region: z.string().trim().min(2).max(80),
    url: z.string().url().max(400).nullable().optional(),
    logoUrl: z.string().url().max(400).nullable().optional(),
    certifications: certificationsSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).default(100),
    effectiveFrom: z.coerce.date().optional(),
  }),
  output: z.object({ id: z.string() }),
  handler: async (input) => {
    const row = await insertRow<{ id: string }>("SubProcessor", {
      name: input.name,
      purpose: input.purpose,
      region: input.region,
      url: input.url ?? null,
      logoUrl: input.logoUrl ?? null,
      certifications: JSON.stringify(input.certifications ?? []),
      sortOrder: input.sortOrder,
      effectiveFrom: input.effectiveFrom ?? new Date(),
    });
    revalidatePath("/trust");
    revalidatePath("/admin/sub-processors");
    return { id: row.id };
  },
});

export const updateSubProcessor = defineAction({
  name: "subprocessor.update",
  permission: "subprocessor.update",
  rateLimit: { scope: "subprocessor.update", limit: 60, windowSec: 600 },
  input: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(2).max(160).optional(),
    purpose: z.string().trim().min(2).max(400).optional(),
    region: z.string().trim().min(2).max(80).optional(),
    url: z.string().url().max(400).nullable().optional(),
    logoUrl: z.string().url().max(400).nullable().optional(),
    certifications: certificationsSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  }),
  handler: async (input) => {
    const existing = await queryOne<{ id: string; retiredAt: Date | null }>(
      'SELECT "id", "retiredAt" FROM "SubProcessor" WHERE "id" = $1',
      [input.id],
    );
    if (!existing) throw fail({ code: "NOT_FOUND" });
    if (existing.retiredAt) {
      throw fail({ code: "CONFLICT", reason: "retired" });
    }

    await updateRows(
      "SubProcessor",
      { id: input.id },
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.certifications !== undefined
          ? { certifications: JSON.stringify(input.certifications) }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    );
    revalidatePath("/trust");
    revalidatePath("/admin/sub-processors");
    return { ok: true as const };
  },
});

export const retireSubProcessor = defineAction({
  name: "subprocessor.retire",
  permission: "subprocessor.retire",
  rateLimit: { scope: "subprocessor.retire", limit: 30, windowSec: 600 },
  input: z.object({
    id: z.string().min(1),
    /** Optional human note for the audit row (not surfaced publicly). */
    reason: z.string().max(400).optional(),
  }),
  handler: async (input) => {
    const existing = await queryOne<{ id: string; retiredAt: Date | null }>(
      'SELECT "id", "retiredAt" FROM "SubProcessor" WHERE "id" = $1',
      [input.id],
    );
    if (!existing) throw fail({ code: "NOT_FOUND" });
    if (existing.retiredAt) return { ok: true as const };

    await updateRows("SubProcessor", { id: input.id }, { retiredAt: new Date() });
    revalidatePath("/trust");
    revalidatePath("/admin/sub-processors");
    return { ok: true as const };
  },
});
