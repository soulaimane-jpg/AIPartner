"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { queryOne, insertRow, updateRows } from "@/lib/db";
import type { ProjectBriefRow } from "@/lib/db/rows";
import { computeCompletion } from "@/lib/brief";
import { safeJsonParse } from "@/lib/utils";

// A lightweight, deterministic AI-like assistant that progressively fills the brief
// as the user chats. If OPENAI_API_KEY is set later, swap in a real LLM here —
// the public contract stays the same.
type Assisted = {
  reply: string;
  patch: Record<string, unknown>;
};

// Keywords → field hints
const FIELD_PROMPTS: { re: RegExp; field: string; hint: string }[] = [
  { re: /\b(summary|problem|goal|objective)\b/i, field: "executiveSummary", hint: "SYNCHRONIZING MISSION OBJECTIVES." },
  { re: /\b(requirement|must have|need to)\b/i, field: "scopeRequirements", hint: "LOGGING SYSTEM REQUIREMENTS." },
  { re: /\b(integration|integrate|connect to|system)\b/i, field: "integrationPoints", hint: "MAPPING INTEGRATION NODES." },
  { re: /\b(data source|database|warehouse|lake|etl)\b/i, field: "dataSources", hint: "INDEXING DATA SOURCES." },
  { re: /\b(success|kpi|metric|measure)\b/i, field: "successCriteria", hint: "CALIBRATING SUCCESS PARAMETERS." },
  { re: /\b(go[- ]?live|deadline|launch date)\b/i, field: "targetGoLive", hint: "SCHEDULING DEPLOYMENT WINDOW." },
  { re: /\b(budget|cost|spend)\b/i, field: "budgetRange", hint: "CALCULATING RESOURCE ALLOCATION." },
  { re: /\b(region|location|based|emea|apac|us\b|eu\b)\b/i, field: "preferredLocation", hint: "GEOLOCATING PARTNER NODES." },
  { re: /\b(certification|cissp|iso|soc)\b/i, field: "requiredCertifications", hint: "VALIDATING COMPLIANCE TOKENS." },
];

function simulateAssistant(userMessage: string, brief: ProjectBriefRow): Assisted {
  const patch: Record<string, unknown> = {};
  const triggered: string[] = [];

  for (const rule of FIELD_PROMPTS) {
    if (rule.re.test(userMessage)) {
      triggered.push(rule.hint);
      if (rule.field === "executiveSummary" && !brief.executiveSummary) {
        patch.executiveSummary = userMessage.slice(0, 600);
      }
      if (rule.field === "scopeRequirements") {
        const items = safeJsonParse<unknown[]>(brief.scopeRequirements ?? "[]", []);
        items.push({ title: userMessage.slice(0, 80), detail: userMessage });
        patch.scopeRequirements = JSON.stringify(items.slice(-10));
      }
      if (rule.field === "integrationPoints") {
        const items = safeJsonParse<unknown[]>(brief.integrationPoints ?? "[]", []);
        items.push({ title: userMessage.slice(0, 80), detail: userMessage });
        patch.integrationPoints = JSON.stringify(items.slice(-10));
      }
      if (rule.field === "dataSources") {
        const items = safeJsonParse<unknown[]>(brief.dataSources ?? "[]", []);
        items.push({ name: userMessage.slice(0, 80), detail: userMessage });
        patch.dataSources = JSON.stringify(items.slice(-10));
      }
      if (rule.field === "successCriteria") {
        const items = safeJsonParse<unknown[]>(brief.successCriteria ?? "[]", []);
        items.push({ metric: userMessage.slice(0, 80), target: "To be defined" });
        patch.successCriteria = JSON.stringify(items.slice(-10));
      }
      if (rule.field === "targetGoLive") {
        patch.targetGoLive = userMessage.slice(0, 120);
      }
      if (rule.field === "budgetRange") {
        patch.budgetRange = userMessage.slice(0, 120);
      }
      if (rule.field === "preferredLocation") {
        patch.preferredLocation = userMessage.slice(0, 120);
      }
      if (rule.field === "requiredCertifications") {
        const items = safeJsonParse<string[]>(brief.requiredCertifications ?? "[]", []);
        items.push(userMessage.slice(0, 80));
        patch.requiredCertifications = JSON.stringify(Array.from(new Set(items)));
      }
    }
  }

  // Next best question based on what's missing
  const missing: string[] = [];
  if (!brief.executiveSummary && !patch.executiveSummary)
    missing.push("Define the core **business problem** and the expected impact of the solution.");
  if (safeJsonParse<unknown[]>(brief.scopeRequirements ?? "[]", []).length === 0 && !patch.scopeRequirements)
    missing.push("Input the critical **capabilities or technical outcomes** required for this mission.");
  if (!brief.targetGoLive && !patch.targetGoLive)
    missing.push("Specify the **target deployment window** or launch deadline.");
  if (!brief.budgetRange && !patch.budgetRange)
    missing.push("Declare the **resource allocation range** (budget) to optimize partner matching.");
  if (safeJsonParse<unknown[]>(brief.successCriteria ?? "[]", []).length === 0 && !patch.successCriteria)
    missing.push("Identify the **KPIs** for mission success. Input 1–2 measurable metrics.");

  const hint = triggered[0]
    ? `[SYSTEM_SIGNAL] — ${triggered[0]}\n\n`
    : "[SYSTEM_LOG] — Data received and indexed.\n\n";

  const nextQuestion = missing[0] ?? "SOW architecture is comprehensive. Are there any additional **compliance tokens** or **geospatial preferences** for partner alignment?";

  const reply = `${hint}${nextQuestion}`;

  return { reply, patch };
}

export async function sendChatMessageAction(
  briefId: string,
  userMessage: string,
): Promise<{ assistant: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const brief = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1 AND "ownerId" = $2',
    [briefId, session.user.id],
  );
  if (!brief) throw new Error("Brief not found");

  await insertRow("ChatMessage", {
    briefId,
    userId: session.user.id,
    role: "user",
    content: userMessage,
  });

  const assisted = simulateAssistant(userMessage, brief);

  const completion = computeCompletion({ ...brief, ...assisted.patch });

  await updateRows(
    "ProjectBrief",
    { id: briefId },
    { ...(assisted.patch as Record<string, unknown>), completion },
  );

  await insertRow("ChatMessage", {
    briefId,
    role: "assistant",
    content: assisted.reply,
  });

  revalidatePath(`/briefs/${briefId}/builder`);
  revalidatePath(`/briefs/${briefId}/preview`);

  return { assistant: assisted.reply };
}
