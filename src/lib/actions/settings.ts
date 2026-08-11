"use server";

/**
 * M12 — platform settings admin actions (plan-A §7).
 * Every timer duration / behaviour toggle is editable here; the
 * timer engine reads them live (30s cache).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { SETTING_DEFS, setSetting, type SettingKey } from "@/lib/settings";

const UpdateSettingInput = z.object({
  key: z.string().min(1),
  /** JSON-encoded value — validated against the default's type. */
  value: z.string().min(1).max(2000),
});

export const adminUpdateSettingAction = defineAction({
  name: "admin.settings.update",
  input: UpdateSettingInput,
  permission: "admin.settings.configure",
  rateLimit: { scope: "admin.settings.update", limit: 60, windowSec: 60 },
  handler: async ({ key, value }, ctx) => {
    if (!(key in SETTING_DEFS)) {
      fail({ code: "NOT_FOUND", resource: "PlatformSetting" });
    }
    const def = SETTING_DEFS[key as SettingKey];

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      fail({
        code: "CONFLICT",
        reason: "Value must be valid JSON (numbers plain, strings quoted)",
      });
    }

    // Type guard against the default's shape.
    const defaultType = Array.isArray(def.default) ? "array" : typeof def.default;
    const parsedType = Array.isArray(parsed) ? "array" : typeof parsed;
    if (defaultType !== parsedType) {
      fail({
        code: "CONFLICT",
        reason: `Expected ${defaultType}, got ${parsedType}`,
      });
    }
    if (defaultType === "number" && ((parsed as number) < 0 || (parsed as number) > 10_000)) {
      fail({ code: "CONFLICT", reason: "Number out of sane range" });
    }

    await setSetting(key as SettingKey, parsed, ctx.user!.id);
    revalidatePath("/admin/settings");
    return { ok: true as const };
  },
});
