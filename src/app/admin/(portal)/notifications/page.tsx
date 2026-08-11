import { query } from "@/lib/db";
import type { NotificationTemplateRow } from "@/lib/db/rows";
import { NOTIFICATION_EVENTS } from "@/lib/notify";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification templates · Admin" };

/**
 * WS13 — §9 notification matrix editor. Each event ships with a
 * built-in default; overrides persist in `NotificationTemplate`.
 * Placeholders use {{variable}} substitution.
 */
export default async function AdminNotificationsPage() {
  const overrides = await query<NotificationTemplateRow>(
    'SELECT * FROM "NotificationTemplate"',
  );
  const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

  const rows = Object.entries(NOTIFICATION_EVENTS).map(([key, def]) => {
    const override = overrideByKey.get(key);
    return {
      key,
      description: def.description,
      defaultSubject: def.subject,
      defaultBody: def.body,
      subject: override?.subject ?? def.subject,
      body: override?.body ?? def.body,
      overridden: Boolean(override),
    };
  });

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Notification templates
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground max-w-2xl">
          Every platform notification (§9 matrix). Edit subject/body with{" "}
          <code className="font-mono text-[12px]">{"{{placeholders}}"}</code>;
          reset returns to the built-in default.
        </p>
      </header>
      <TemplateEditor templates={rows} />
    </div>
  );
}
