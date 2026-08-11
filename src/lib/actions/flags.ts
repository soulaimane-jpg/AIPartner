"use server";

/**
 * Server Actions for the admin feature-flag console.
 *
 * Each action is wrapped with `defineAction` so we get audit logging,
 * permission checks, and structured errors for free.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exec } from "@/lib/db";
import { defineAction } from "@/lib/actions/define";
import { setFlag, invalidateFlagCache } from "@/lib/flags";

const FlagAudienceSchema = z
  .object({
    roles: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    companyIds: z.array(z.string()).optional(),
  })
  .strict();

const UpsertFlagInput = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_.-]*$/i, "Use letters, digits, dot, dash, underscore"),
  description: z.string().trim().max(500).optional().nullable(),
  enabled: z.coerce.boolean(),
  rolloutPct: z.coerce.number().int().min(0).max(100),
  audience: FlagAudienceSchema.optional(),
  ownerEmail: z.string().email().optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().trim().max(500).optional(),
});

export const upsertFeatureFlagAction = defineAction({
  name: "flag.upsert",
  input: UpsertFlagInput,
  permission: "admin.flag.toggle",
  rateLimit: { scope: "flag.upsert", limit: 30, windowSec: 60 },
  handler: async (parsed, ctx) => {
    await setFlag({
      actorId: ctx.user?.id ?? null,
      key: parsed.key,
      patch: {
        description: parsed.description ?? null,
        enabled: parsed.enabled,
        rolloutPct: parsed.rolloutPct,
        audience: parsed.audience ?? {},
        ownerEmail: parsed.ownerEmail ?? null,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      },
      reason: parsed.reason,
    });
    revalidatePath("/admin/flags");
    return { ok: true as const };
  },
});

const ToggleFlagInput = z.object({
  key: z.string().min(2),
  enabled: z.coerce.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const toggleFeatureFlagAction = defineAction({
  name: "flag.toggle",
  input: ToggleFlagInput,
  permission: "admin.flag.toggle",
  rateLimit: { scope: "flag.toggle", limit: 60, windowSec: 60 },
  handler: async ({ key, enabled, reason }, ctx) => {
    await setFlag({
      actorId: ctx.user?.id ?? null,
      key,
      patch: { enabled },
      reason: reason ?? `${enabled ? "Enabled" : "Disabled"} via admin UI`,
    });
    revalidatePath("/admin/flags");
    return { ok: true as const };
  },
});

const DeleteFlagInput = z.object({ key: z.string().min(2) });

export const deleteFeatureFlagAction = defineAction({
  name: "flag.delete",
  input: DeleteFlagInput,
  permission: "admin.flag.toggle",
  rateLimit: { scope: "flag.delete", limit: 20, windowSec: 60 },
  handler: async ({ key }) => {
    await exec('DELETE FROM "FeatureFlag" WHERE "key" = $1', [key]);
    invalidateFlagCache();
    revalidatePath("/admin/flags");
    return { ok: true as const };
  },
});
