import { query } from "@/lib/db";
import type { PreferenceQuestionRow } from "@/lib/db/rows";
import { listSettings } from "@/lib/settings";
import { getEnabledPreferenceQuestions } from "@/lib/preferences";
import { SettingsEditor } from "./settings-editor";
import { PreferenceQuestionsEditor } from "./preference-questions-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform settings · Admin" };

/**
 * M12 — platform settings: every timer duration and behaviour toggle
 * (§7), plus the partner-preference questions companies see at brief
 * intake (M3.4). No durations live in code.
 */
export default async function AdminSettingsPage() {
  const [settings, enabledQuestions, allQuestions] = await Promise.all([
    listSettings(),
    getEnabledPreferenceQuestions(),
    query<PreferenceQuestionRow>(
      'SELECT * FROM "PreferenceQuestion" ORDER BY "rank" ASC',
    ),
  ]);
  void enabledQuestions; // seeding side-effect

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title">
          Platform settings
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground max-w-2xl">
          Timers, reminder offsets and behaviour toggles. Changes apply within
          30 seconds — running timers keep their original deadline.
        </p>
      </header>

      <SettingsEditor
        settings={settings.map((s) => ({
          key: s.key,
          value: JSON.stringify(s.value),
          defaultValue: JSON.stringify(s.default),
          description: s.description,
          updatedAt: s.updatedAt?.toISOString() ?? null,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-foreground">
          Partner-preference questions (brief intake)
        </h2>
        <p className="text-[13px] text-muted-foreground max-w-2xl">
          Companies answer these while creating a brief; the answers guide
          partner selection. Toggle and re-label without code changes.
        </p>
        <PreferenceQuestionsEditor
          questions={allQuestions.map((q) => ({
            fieldKey: q.fieldKey,
            label: q.label,
            enabled: q.enabled,
            rank: q.rank,
          }))}
        />
      </section>
    </div>
  );
}
