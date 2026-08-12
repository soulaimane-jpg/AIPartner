"use server";

/**
 * AI outreach drafting.
 *
 * One Server Action: `draftOutreachAction({ briefId, partnerId })`.
 * Returns a structured `{ subject, body, fitNote }` the admin reviews
 * and edits before send.
 *
 * Anonymisation guarantee: we only feed Claude the **already-
 * anonymised** brief fields (`executiveSummary`, services list,
 * region). Raw customer name / domain / personal email *never* enter
 * the prompt. The partner-side acceptance email rendered by
 * `renderPartnerOutreach` stays the authoritative template; this is a
 * compose-aid, not a replacement.
 */

import { z } from "zod";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne } from "@/lib/db";
import type {
  ProjectBriefRow,
  CompanyRow,
  PartnerProfileRow,
} from "@/lib/db/rows";
import { parseLlmJson } from "@/lib/ai/parse";
import {
  OutreachDraftV1,
} from "@/lib/schemas/ai/outreach-draft";

const OUTREACH_SYSTEM = `You are AI Partner's outreach writer. An admin is about to email a Google Cloud delivery partner about a new project opportunity. Draft a short, respectful email that:

- Opens with one sentence acknowledging the partner specifically (tier, region, or relevant case study).
- States the opportunity in 2-3 plain sentences — what problem, what scope, what region.
- Closes with a single ask: "click here to accept the lead terms and see the full brief".

Tone: senior peer-to-peer. No marketing fluff. No "we are thrilled
to". No "delivery excellence". No emojis. Keep total length under
220 words.

Return ONLY a single JSON object — no prose, no code fences — matching:

{
  "subject": "Plain-text subject line, ≤ 120 chars",
  "body": "Multi-paragraph body. Use \\n\\n between paragraphs.",
  "fitNote": "1-sentence 'why I'm reaching out to this partner' — admin-only context (NOT sent to the partner). Or null."
}`;

function buildOutreachUser(opts: {
  briefTitle: string;
  briefExecutiveSummary: string | null;
  briefServices: string[];
  briefRegion: string | null;
  partnerName: string;
  partnerTier: string | null;
  partnerSpecializations: string[];
  partnerCaseStudyTitle: string | null;
}): string {
  return [
    `# Brief (anonymised)`,
    `Title: ${opts.briefTitle}`,
    `Region: ${opts.briefRegion ?? "(any)"}`,
    `Services: ${opts.briefServices.join(", ") || "(unspecified)"}`,
    `Summary: ${
      (opts.briefExecutiveSummary ?? "(empty)").slice(0, 600)
    }`,
    ``,
    `# Partner`,
    `Name: ${opts.partnerName}`,
    `Tier: ${opts.partnerTier ?? "(unknown)"}`,
    `Specialisations: ${opts.partnerSpecializations.join(", ") || "(unspecified)"}`,
    opts.partnerCaseStudyTitle
      ? `Most relevant case study on file: ${opts.partnerCaseStudyTitle}`
      : ``,
  ]
    .filter(Boolean)
    .join("\n");
}

const DraftOutreachInput = z.object({
  briefId: z.string().min(1),
  partnerId: z.string().min(1),
  /** Optional admin hint — "please emphasise their EMEA presence". */
  styleHint: z.string().max(280).optional(),
});

export const draftOutreachAction = defineAction({
  name: "admin.outreach.draft",
  input: DraftOutreachInput,
  output: OutreachDraftV1,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.outreach.draft", limit: 30, windowSec: 600 },
  handler: async ({ briefId, partnerId, styleHint }) => {
    const [brief, partner, profile] = await Promise.all([
      queryOne<ProjectBriefRow>(
        'SELECT * FROM "ProjectBrief" WHERE "id" = $1',
        [briefId],
      ),
      queryOne<CompanyRow>('SELECT * FROM "Company" WHERE "id" = $1', [
        partnerId,
      ]),
      queryOne<PartnerProfileRow>(
        'SELECT * FROM "PartnerProfile" WHERE "companyId" = $1',
        [partnerId],
      ),
    ]);
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });
    if (!partner || partner.kind !== "PARTNER") {
      fail({ code: "NOT_FOUND", resource: "Partner" });
    }

    const specializations = parseArr<string>(profile?.specializations);
    const caseStudies = parseArr<{ title: string; industry?: string }>(
      profile?.caseStudies,
    );

    const userMsg = [
      buildOutreachUser({
        briefTitle: brief!.title,
        briefExecutiveSummary: brief!.executiveSummary,
        briefServices: parseArr<string>(brief!.services),
        briefRegion: brief!.preferredLocation,
        partnerName: partner!.name,
        partnerTier: profile?.tier ?? null,
        partnerSpecializations: specializations,
        partnerCaseStudyTitle: caseStudies[0]?.title ?? null,
      }),
      styleHint ? `\n# Admin style note\n${styleHint}` : "",
    ].join("\n");

    const result = await parseLlmJson({
      schema: OutreachDraftV1,
      system: OUTREACH_SYSTEM,
      user: userMsg,
      tag: "admin-outreach",
      // Interpolates partner-authored profile fields.
      untrustedInput: true,
      maxTokens: 800,
      temperature: 0.5,
    });

    if (!result.ok) {
      fail({
        code: "LLM_FAILURE",
        retryable: result.error.code === "LLM_TRANSPORT",
      });
    }
    return result.data;
  },
});

function parseArr<T>(input: unknown): T[] {
  if (Array.isArray(input)) return input as T[];
  if (typeof input === "string") {
    try {
      const v = JSON.parse(input);
      return Array.isArray(v) ? (v as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
