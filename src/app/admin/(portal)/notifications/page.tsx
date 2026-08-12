import { query } from "@/lib/db";
import type { NotificationTemplateRow } from "@/lib/db/rows";
import { NOTIFICATION_EVENTS } from "@/lib/notify";
import { TemplateEditor } from "./template-editor";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notification templates · Admin" };

/**
 * WS13 — §9 notification matrix editor. Each event ships with a
 * built-in default; overrides persist in `NotificationTemplate`.
 * Placeholders use {{variable}} substitution.
 */
export default async function AdminNotificationsPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

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
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title">
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
