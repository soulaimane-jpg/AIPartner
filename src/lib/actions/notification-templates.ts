"use server";

/**
 * WS13 — admin-editable notification templates (plan-A §9).
 * Overrides live in `NotificationTemplate`; missing keys fall back to
 * the built-in defaults in `src/lib/notify.ts`.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { exec, insertRow } from "@/lib/db";
import { NOTIFICATION_EVENTS } from "@/lib/notify";

const UpsertTemplateInput = z.object({
  key: z.string().min(1),
  subject: z.string().min(3).max(500),
  body: z.string().min(3).max(20_000),
});

export const adminUpsertNotificationTemplateAction = defineAction({
  name: "admin.notification-template.upsert",
  input: UpsertTemplateInput,
  permission: "admin.settings.configure",
  rateLimit: { scope: "admin.notif-template", limit: 60, windowSec: 60 },
  handler: async ({ key, subject, body }) => {
    if (!(key in NOTIFICATION_EVENTS)) {
      fail({ code: "NOT_FOUND", resource: "NotificationTemplate" });
    }
    await insertRow(
      "NotificationTemplate",
      { key, subject, body },
      {
        onConflict: `("key") DO UPDATE SET
          "subject" = EXCLUDED."subject",
          "body" = EXCLUDED."body",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );
    revalidatePath("/admin/notifications");
    return { ok: true as const };
  },
});

const ResetTemplateInput = z.object({ key: z.string().min(1) });

export const adminResetNotificationTemplateAction = defineAction({
  name: "admin.notification-template.reset",
  input: ResetTemplateInput,
  permission: "admin.settings.configure",
  rateLimit: { scope: "admin.notif-template", limit: 60, windowSec: 60 },
  handler: async ({ key }) => {
    await exec('DELETE FROM "NotificationTemplate" WHERE "key" = $1', [key]);
    revalidatePath("/admin/notifications");
    return { ok: true as const };
  },
});
