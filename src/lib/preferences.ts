/**
 * Partner-preference questions shown to companies during brief
 * intake (plan-A M3.4). Admin-configurable via `PreferenceQuestion`;
 * defaults seeded on first read. Answers persist on
 * `ProjectBrief.partnerPreferences` (JSON) and inform admin partner
 * selection — they are hints, not hard filters.
 */

import "server-only";
import { query, count, insertRow } from "@/lib/db";

const DEFAULT_QUESTIONS: Array<{
  fieldKey: string;
  label: string;
  rank: number;
}> = [
  {
    fieldKey: "regions",
    label: "Should the partner be in your region / time zone?",
    rank: 10,
  },
  {
    fieldKey: "languages",
    label: "Which languages should the partner team speak?",
    rank: 20,
  },
  {
    fieldKey: "specializations",
    label: "Any Google Cloud specializations that matter to you?",
    rank: 30,
  },
  {
    fieldKey: "sizeBand",
    label: "Do you prefer a boutique specialist or a larger firm?",
    rank: 40,
  },
];

export interface PreferenceQuestionDef {
  fieldKey: string;
  label: string;
  rank: number;
}

/** Enabled questions in rank order, seeding defaults on first call. */
export async function getEnabledPreferenceQuestions(): Promise<
  PreferenceQuestionDef[]
> {
  const existing = await count('SELECT COUNT(*) AS count FROM "PreferenceQuestion"');
  if (existing === 0) {
    for (const q of DEFAULT_QUESTIONS) {
      await insertRow(
        "PreferenceQuestion",
        { ...q, enabled: true },
        { onConflict: '("fieldKey") DO NOTHING' },
      ).catch(() => undefined);
    }
  }
  const rows = await query<{ fieldKey: string; label: string; rank: number }>(
    'SELECT "fieldKey", "label", "rank" FROM "PreferenceQuestion" WHERE "enabled" = TRUE ORDER BY "rank" ASC',
  );
  return rows.map((r) => ({
    fieldKey: r.fieldKey,
    label: r.label,
    rank: r.rank,
  }));
}
