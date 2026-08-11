"use server";

/**
 * M3 Path B — "book a call" brief creation (plan-A §6 M3.2/M3.3).
 *
 *   1. Customer books a scoping call → draft brief with
 *      `origin: "call"`; admins are notified with the customer's
 *      availability note.
 *   2. After the call, an admin attaches the transcript; Claude
 *      extracts the canonical brief sections (marked `aiGenerated`)
 *      and the customer is notified to review (§9 event 3).
 *   3. The customer edits/confirms — confirmation flips the lead to
 *      SUBMITTED through the state machine. AI-generated content is
 *      never sent to triage without explicit customer confirmation
 *      (golden rule: human always reviews AI output — §4.2).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, updateRows } from "@/lib/db";
import { parseLlmJson } from "@/lib/ai/parse";
import {
  CALL_BRIEF_SYSTEM,
  CallBriefExtractionV1,
} from "@/lib/schemas/ai/call-brief";
import { BRIEF_SECTIONS, isBriefSectionKey } from "@/lib/sections";
import { transitionLead } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { notify, notifyAdmins } from "@/lib/notify";

// ─── 1. Book a call ───────────────────────────────────────────

const BookCallInput = z.object({
  topic: z.string().min(3).max(300),
  /** Free-text availability, e.g. "Tue/Wed afternoons CET". */
  availabilityNote: z.string().max(1000).optional(),
});

export const bookBriefCallAction = defineAction({
  name: "brief.call.book",
  input: BookCallInput,
  output: z.object({ briefId: z.string() }),
  permission: "brief.create",
  rateLimit: { scope: "brief.call.book", limit: 5, windowSec: 3600 },
  handler: async ({ topic, availabilityNote }, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Company membership required" });
    }

    const brief = await insertRow<{ id: string }>("ProjectBrief", {
      title: topic,
      ownerId: ctx.user!.id,
      companyId: ctx.user!.companyId!,
      origin: "call",
      stage: "INTAKE",
      leadState: "DRAFT",
      status: "DRAFT",
    });

    await notifyAdmins({
      event: "clarification.new_message",
      vars: {
        briefTitle: topic,
        fromLabel: `${ctx.user!.name ?? ctx.user!.email} (call request)`,
        preview:
          `New scoping-call request.\nAvailability: ${availabilityNote?.trim() || "not specified"}\n` +
          `Schedule the call, then attach the transcript to generate the brief.`,
      },
      link: `/admin/briefs/${brief.id}/transcript`,
      briefId: brief.id,
      idemKey: `call-booked:${brief.id}`,
    });

    revalidatePath("/briefs");
    revalidatePath("/dashboard");
    return { briefId: brief.id };
  },
});

// ─── 2. Attach transcript + extract (admin) ───────────────────

const AttachTranscriptInput = z.object({
  briefId: z.string().min(1),
  transcript: z.string().min(100, "Transcript looks too short").max(400_000),
  recordingRef: z.string().max(2000).optional(),
});

export const adminAttachTranscriptAction = defineAction({
  name: "admin.brief.transcript.attach",
  input: AttachTranscriptInput,
  output: z.object({
    sectionsWritten: z.number(),
    openQuestions: z.array(z.string()),
    confidence: z.number(),
  }),
  permission: "admin.triage",
  rateLimit: { scope: "admin.brief.transcript", limit: 10, windowSec: 600 },
  handler: async ({ briefId, transcript, recordingRef }, ctx) => {
    const brief = await queryOne<{
      id: string;
      title: string;
      ownerId: string;
      origin: string | null;
    }>(
      'SELECT "id", "title", "ownerId", "origin" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    // Persist raw transcript first — extraction is retryable.
    await updateRows(
      "ProjectBrief",
      { id: briefId },
      {
        callTranscript: transcript,
        callRecordingRef: recordingRef ?? null,
        origin: "call",
      },
    );

    const result = await parseLlmJson({
      schema: CallBriefExtractionV1,
      system: CALL_BRIEF_SYSTEM,
      user: `# Call transcript\n\n${transcript.slice(0, 150_000)}`,
      tag: "call-brief-extraction",
      maxTokens: 4000,
      temperature: 0.1,
    });
    if (!result.ok) {
      fail({
        code: "LLM_FAILURE",
        retryable: result.error.code === "LLM_TRANSPORT",
      });
    }
    const extraction = result.data;

    // Upsert canonical sections (aiGenerated=true so reviewers know).
    let written = 0;
    for (const [key, content] of Object.entries(extraction.sections)) {
      if (!isBriefSectionKey(key) || !content.trim()) continue;
      await insertRow(
        "BriefSection",
        {
          briefId,
          key,
          content: content.trim(),
          aiGenerated: true,
          rank: BRIEF_SECTIONS[key].rank,
        },
        {
          onConflict: `("briefId", "key") DO UPDATE SET
            "content" = EXCLUDED."content",
            "aiGenerated" = TRUE,
            "updatedAt" = EXCLUDED."updatedAt"`,
        },
      );
      written++;
    }

    await updateRows("ProjectBrief", { id: briefId }, {
      title: extraction.title,
      ...(extraction.sections.context_and_goals
        ? { executiveSummary: extraction.sections.context_and_goals }
        : {}),
      services: JSON.stringify(extraction.services),
    });

    // §9 event 3 — customer reviews the generated brief.
    await notify({
      event: "brief.call_generated_ready",
      recipients: [{ userId: brief!.ownerId }],
      vars: { briefTitle: extraction.title },
      link: `/briefs/${briefId}/review-call`,
      briefId,
      idemKey: `call-generated:${briefId}`,
    });

    void ctx;
    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/briefs/${briefId}`);
    return {
      sectionsWritten: written,
      openQuestions: extraction.openQuestions,
      confidence: extraction.confidence,
    };
  },
});

// ─── 3. Customer edits + confirms ─────────────────────────────

const UpdateSectionInput = z.object({
  briefId: z.string().min(1),
  key: z.string().min(1),
  content: z.string().max(20_000),
});

export const updateBriefSectionAction = defineAction({
  name: "brief.section.update",
  input: UpdateSectionInput,
  permission: "brief.update",
  rateLimit: { scope: "brief.section.update", limit: 60, windowSec: 60 },
  handler: async ({ briefId, key, content }) => {
    if (!isBriefSectionKey(key)) {
      fail({ code: "NOT_FOUND", resource: "BriefSection" });
    }
    // Human edit clears the AI flag — a person has owned this text.
    await insertRow(
      "BriefSection",
      {
        briefId,
        key,
        content,
        aiGenerated: false, // human-edited
        rank: BRIEF_SECTIONS[key as keyof typeof BRIEF_SECTIONS].rank,
      },
      {
        onConflict: `("briefId", "key") DO UPDATE SET
          "content" = EXCLUDED."content",
          "aiGenerated" = FALSE,
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );
    revalidatePath(`/briefs/${briefId}/review-call`);
    return { ok: true as const };
  },
});

const ConfirmCallBriefInput = z.object({
  briefId: z.string().min(1),
});

export const confirmCallBriefAction = defineAction({
  name: "brief.call.confirm",
  input: ConfirmCallBriefInput,
  permission: "brief.submit",
  rateLimit: { scope: "brief.call.confirm", limit: 10, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    const brief = await queryOne<{ id: string }>(
      'SELECT "id" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    const briefSections = await query<{ key: string; content: string }>(
      'SELECT "key", "content" FROM "BriefSection" WHERE "briefId" = $1',
      [briefId],
    );

    // Mandatory-section guard (M3.6): context, scope, environment,
    // technical requirements, timeline, success criteria.
    const present = new Set(
      briefSections.filter((s) => s.content.trim()).map((s) => s.key),
    );
    const missing = Object.values(BRIEF_SECTIONS)
      .filter((meta) => meta.mandatory && !present.has(meta.key))
      .map((meta) => meta.label);
    if (missing.length > 0) {
      fail({
        code: "CONFLICT",
        reason: `Missing mandatory sections: ${missing.join(", ")}`,
      });
    }

    await updateRows(
      "ProjectBrief",
      { id: briefId },
      { status: "ACTIVE", submittedAt: new Date() },
    );
    await transitionLead({
      briefId,
      to: "SUBMITTED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      meta: { origin: "call", confirmedSections: briefSections.length },
    });

    revalidatePath(`/briefs/${briefId}`);
    revalidatePath("/dashboard");
    return { ok: true as const };
  },
});
