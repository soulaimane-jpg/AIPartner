import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import type { ProjectBriefRow, ChatMessageRow } from "@/lib/db/rows";
import {
  anthropic,
  CLAUDE_MODEL,
  stripBriefUpdate,
  parseBriefUpdate,
  parseAnswerRating,
} from "@/lib/claude";
import { computeCompletion, computeCompletionBreakdown } from "@/lib/brief";
import { getBriefCapabilities } from "@/lib/workspace-access";
import { buildBriefSystemPrompt } from "@/lib/brief-prompts";
import { revalidatePath } from "next/cache";
// TEMP: capture last error for /api/_debug/last-chat-error. Remove once diagnosed.
import { recordChatError } from "@/lib/_debug-last-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_FIELDS = new Set([
  "scopeRequirements",
  "dataSources",
  "integrationPoints",
  "successCriteria",
  "customerRoles",
  "milestones",
  "requiredCertifications",
  "industryExperience",
  "decisionMakers",
  "selectionCriteria",
  "services",
]);

const STRING_FIELDS = new Set([
  "title",
  "executiveSummary",
  "targetGoLive",
  "budgetRange",
  "preferredLocation",
  "procurementType",
]);

/**
 * Total attachment text allowed into a single prompt.
 *
 * Each file is already capped at 40k chars on upload, but ten of them would
 * still crowd out the conversation itself. We spend at most ~30k tokens on
 * documents and tell the model plainly when something was left out, rather
 * than silently truncating and letting it answer from a partial document.
 */
const MAX_TOTAL_ATTACHMENT_CHARS = 120_000;

function buildAttachmentContext(
  attachments: ReadonlyArray<{
    filename: string;
    mimeType: string;
    extractedText: string | null;
    extractionStatus: string;
  }>,
): string {
  if (attachments.length === 0) return "";

  const sections: string[] = [];
  const imagesOnly: string[] = [];
  const unreadable: string[] = [];
  let budget = MAX_TOTAL_ATTACHMENT_CHARS;
  let omitted = 0;

  for (const a of attachments) {
    if (a.mimeType.startsWith("image/")) {
      imagesOnly.push(a.filename);
      continue;
    }
    if (a.extractionStatus !== "ready" || !a.extractedText) {
      unreadable.push(a.filename);
      continue;
    }
    if (budget <= 0) {
      omitted += 1;
      continue;
    }
    const slice = a.extractedText.slice(0, budget);
    budget -= slice.length;
    sections.push(
      `### File: ${a.filename}\n${slice}${
        slice.length < a.extractedText.length ? "\n…[truncated]" : ""
      }`,
    );
  }

  if (!sections.length && !imagesOnly.length && !unreadable.length) return "";

  let out =
    `\n\n# ATTACHED DOCUMENTS\n` +
    `The customer uploaded these files for THIS brief. Treat them as primary source ` +
    `material: prefer their contents over assumptions, cite the filename when you use ` +
    `a detail from one, and don't ask for information a document already answers.\n`;

  if (sections.length) out += `\n${sections.join("\n\n")}\n`;
  if (imagesOnly.length) {
    out +=
      `\nImages attached (not transcribed here): ${imagesOnly.join(", ")}. ` +
      `Ask the customer to describe them if their content matters.\n`;
  }
  if (unreadable.length) {
    out +=
      `\nAttached but no readable text could be extracted (likely scans): ` +
      `${unreadable.join(", ")}. Ask the customer for the key details instead.\n`;
  }
  if (omitted) {
    out += `\n${omitted} further attachment(s) were omitted to stay within context limits.\n`;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { briefId, message } = (await req.json()) as {
    briefId: string;
    message: string;
  };

  if (!briefId || typeof message !== "string" || !message.trim()) {
    return new Response("Bad Request", { status: 400 });
  }

  const capabilities = await getBriefCapabilities(
    {
      userId: session.user.id,
      companyId: session.user.companyId,
      platformRole: session.user.role,
    },
    briefId,
  );
  if (!capabilities.canEditBrief) return new Response("Not found", { status: 404 });

  const brief = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!brief) return new Response("Not found", { status: 404 });
  const priorMessages = await query<ChatMessageRow>(
    'SELECT * FROM "ChatMessage" WHERE "briefId" = $1 ORDER BY "createdAt" ASC',
    [briefId],
  );

  // Save the user message (we'll attach the per-answer rating to it once
  // the assistant's reply is parsed).
  const savedUserMessage = await insertRow<ChatMessageRow>("ChatMessage", {
    briefId,
    userId: session.user.id,
    role: "user",
    content: message,
  });

  // Build conversation history for Claude
  const history = priorMessages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
  history.push({ role: "user", content: message });

  // Add a FULL snapshot of what we already know so Claude doesn't re-ask
  // and can steer the conversation toward missing fields.
  const known: Record<string, unknown> = {
    title: brief.title,
    executiveSummary: brief.executiveSummary,
    targetGoLive: brief.targetGoLive,
    budgetRange: brief.budgetRange,
    preferredLocation: brief.preferredLocation,
    completion: brief.completion,
    // Fields set during brief creation (qualification wizard)
    services: safeJsonParseList(brief.services),
    deliveryModel: safeJsonParseList(brief.deliveryModel),
    procurement: brief.procurement,
    usesCloudToday: brief.usesCloud,
    hasWorkedWithPartnerBefore: brief.hadPartner,
    cloudContextSnapshot: briefCloudContext(brief),
    // Fields accumulated during chat
    scopeRequirements: safeJsonParseList(brief.scopeRequirements),
    dataSources: safeJsonParseList(brief.dataSources),
    integrationPoints: safeJsonParseList(brief.integrationPoints),
    successCriteria: safeJsonParseList(brief.successCriteria),
    customerRoles: safeJsonParseList(brief.customerRoles),
    milestones: safeJsonParseList(brief.milestones),
    requiredCertifications: safeJsonParseList(brief.requiredCertifications),
    industryExperience: safeJsonParseList(brief.industryExperience),
    decisionMakers: safeJsonParseList(brief.decisionMakers),
    selectionCriteria: safeJsonParseList(brief.selectionCriteria),
    procurementType: brief.procurementType,
  };

  // Documents the customer attached to this brief. Their extracted text is
  // appended to the system prompt so every turn can cite them without us
  // re-reading the objects out of the bucket.
  //
  // Scoped by briefId, which is itself gated by `getBriefCapabilities` above,
  // so no other tenant's uploads can enter this prompt.
  const attachments = await query<{
    filename: string;
    mimeType: string;
    extractedText: string | null;
    extractionStatus: string;
  }>(
    `SELECT "filename", "mimeType", "extractedText", "extractionStatus"
       FROM "BriefAttachment"
      WHERE "briefId" = $1
      ORDER BY "createdAt" ASC`,
    [briefId],
  );

  const systemWithContext =
    buildBriefSystemPrompt(brief) +
    `\n\n# CURRENT BRIEF STATE (what you've already captured)\n` +
    JSON.stringify(known, null, 2) +
    `\n\nPick up from here — don't re-ask what's known.` +
    buildProgressBlock(brief) +
    buildAttachmentContext(attachments);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullReply = "";
      try {
        const response = await anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: systemWithContext,
          messages: history,
        });

        // Progressive stripping of structured tags. We don't know which tag
        // (if any) is forming inside the trailing buffer, so we only emit
        // content that can't possibly be the start of a tag.
        const TAGS = ["brief_update", "answer_rating"];
        const OPEN_TAGS = TAGS.map((t) => `<${t}>`);
        const CLOSE_TAGS = TAGS.map((t) => `</${t}>`);
        let insideTag: string | null = null;
        let buffer = "";

        const flushSafe = () => {
          // Keep the last N chars in the buffer in case a tag is forming.
          const maxTagLen = Math.max(
            ...OPEN_TAGS.map((t) => t.length),
            ...CLOSE_TAGS.map((t) => t.length),
          );
          const safe = buffer.slice(0, Math.max(0, buffer.length - maxTagLen));
          if (safe) {
            controller.enqueue(encoder.encode(safe));
            buffer = buffer.slice(safe.length);
          }
        };

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            fullReply += chunk;
            buffer += chunk;

            // Progressively strip any <tag>...</tag> in TAGS.
            while (buffer.length > 0) {
              if (insideTag) {
                const close = `</${insideTag}>`;
                const idx = buffer.indexOf(close);
                if (idx === -1) {
                  buffer = ""; // swallow everything until the close arrives
                  break;
                }
                buffer = buffer.slice(idx + close.length);
                insideTag = null;
                continue;
              }

              // Find the earliest opening tag in the buffer.
              let earliest = -1;
              let which: string | null = null;
              for (const t of TAGS) {
                const open = `<${t}>`;
                const idx = buffer.indexOf(open);
                if (idx !== -1 && (earliest === -1 || idx < earliest)) {
                  earliest = idx;
                  which = t;
                }
              }
              if (earliest === -1) {
                flushSafe();
                break;
              }
              if (earliest > 0) {
                controller.enqueue(encoder.encode(buffer.slice(0, earliest)));
              }
              buffer = buffer.slice(earliest + `<${which!}>`.length);
              insideTag = which;
            }
          }
        }

        // Emit any remaining safe buffer.
        if (buffer && !insideTag) {
          controller.enqueue(encoder.encode(buffer));
        }

        // After the stream is complete, persist the conversational reply,
        // the per-answer rating (attached to the user message), and the
        // structured brief_update patch.
        const visibleReply = stripBriefUpdate(fullReply);
        const patch = parseBriefUpdate(fullReply);
        const rating = parseAnswerRating(fullReply);

        await insertRow("ChatMessage", {
          briefId,
          role: "assistant",
          content: visibleReply,
        });

        if (rating) {
          await updateRows(
            "ChatMessage",
            { id: savedUserMessage.id },
            { meta: JSON.stringify(rating) },
          );
        }

        await applyBriefPatch(briefId, patch);

        revalidatePath(`/briefs/${briefId}/builder`);
        revalidatePath(`/briefs/${briefId}/preview`);
        revalidatePath("/dashboard");

        controller.close();
      } catch (err) {
        console.error("Claude chat error:", err);
        // TEMP: capture for /api/_debug/last-chat-error
        recordChatError(err);
        const errMsg =
          "\n\n_Sorry — I hit a connection issue. Please try again in a moment._";
        controller.enqueue(encoder.encode(errMsg));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function applyBriefPatch(
  briefId: string,
  patch: Record<string, unknown>,
) {
  if (!patch || Object.keys(patch).length === 0) return;

  const current = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (!current) return;

  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") continue;

    if (key === "readyForReview") continue; // handled separately in UI

    if (STRING_FIELDS.has(key)) {
      if (typeof value === "string" && value.trim()) {
        data[key] = value.trim();
      }
    } else if (JSON_FIELDS.has(key)) {
      // Merge: dedupe arrays by stringified value
      const existingRaw = current[key as keyof ProjectBriefRow] as
        | string
        | null;
      const existing = existingRaw ? safeParse<unknown[]>(existingRaw, []) : [];
      const incoming = Array.isArray(value) ? value : [];
      const combined = dedupe([...existing, ...incoming]);
      data[key] = JSON.stringify(combined);
    }
  }

  if (Object.keys(data).length === 0) return;

  await updateRows("ProjectBrief", { id: briefId }, data);

  const next = await queryOne<ProjectBriefRow>(
    'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
    [briefId],
  );
  if (next) {
    const completion = computeCompletion(next);
    await updateRows("ProjectBrief", { id: briefId }, { completion });
  }
}

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function safeJsonParseList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function buildProgressBlock(brief: ProjectBriefRow): string {
  const progress = computeCompletionBreakdown(brief);
  const open = progress.sections
    .filter((section) => section.missing.length > 0)
    .sort(
      (a, b) => b.weight - b.score - (a.weight - a.score),
    );

  if (open.length === 0) {
    return (
      `\n\n# SOW PROGRESS — ${progress.total}% complete\n` +
      `Every section is covered. Summarise what you captured in 4-6 bullets and ask the ` +
      `customer to confirm the brief is ready for partner matching.`
    );
  }

  const lines = open.map(
    (section) =>
      `- ${section.label} (${section.score}/${section.weight} points) — still needs: ${section.missing.join("; ")}`,
  );

  return (
    `\n\n# SOW PROGRESS — ${progress.total}% complete\n` +
    `These sections are still open, ordered by how many points they would add. ` +
    `Your next question must target the first one, unless the customer just raised ` +
    `something else:\n${lines.join("\n")}`
  );
}

function briefCloudContext(brief: ProjectBriefRow): Record<string, unknown> {
  const snapshot = safeJsonParseObj(brief.cloudContextSnapshot);
  if (brief.intentRoute === "COMMERCIAL") return snapshot;

  const raw = snapshot.providers;
  const providers =
    typeof raw === "string"
      ? safeJsonParseList(raw)
      : Array.isArray(raw)
        ? raw
        : [];
  return {
    providers: providers.map((entry) =>
      entry && typeof entry === "object" && "provider" in entry
        ? (entry as { provider: unknown }).provider
        : entry,
    ),
    gcpGreenfield: snapshot.gcpGreenfield ?? null,
  };
}

function safeJsonParseObj(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key =
      typeof item === "string" ? item.toLowerCase() : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
