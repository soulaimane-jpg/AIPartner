/**
 * Zod contract for transcript → structured brief extraction
 * (plan-A M3 Path B). Keys mirror the canonical brief section
 * registry in `src/lib/sections.ts`.
 */

import { z } from "zod";

export const CALL_BRIEF_VERSION = "call-brief-v1";

export const CallBriefExtractionV1 = z.object({
  /** 3–8 word human-readable project title. */
  title: z.string().min(3).max(200),
  /** Section content keyed by canonical brief section keys. */
  sections: z.object({
    context_and_goals: z.string().default(""),
    scope: z.string().default(""),
    current_environment: z.string().default(""),
    technical_requirements: z.string().default(""),
    timeline: z.string().default(""),
    budget_band: z.string().default(""),
    resell_interest: z.string().default(""),
    success_criteria: z.string().default(""),
    constraints: z.string().default(""),
    other: z.string().default(""),
  }),
  /** Service keys mentioned (align with platform services list). */
  services: z.array(z.string()).default([]),
  /** Anything the call left ambiguous — surfaces to triage admin. */
  openQuestions: z.array(z.string()).default([]),
  /** 0–100 extraction confidence for admin review prioritisation. */
  confidence: z.number().int().min(0).max(100).default(50),
});

export type CallBriefExtractionV1 = z.infer<typeof CallBriefExtractionV1>;

export const CALL_BRIEF_SYSTEM = `You are AIPartner's intake analyst. You receive the transcript of a scoping call between the AIPartner team and a customer describing a Google Cloud project. Extract a structured project brief.

Rules:
- Write in clean, neutral third-person prose the customer will review and confirm ("The company wants to…").
- NEVER invent facts. If the transcript doesn't cover a section, leave it as an empty string.
- Redact nothing — this brief is confirmed by the customer before any partner sees it; anonymization happens later in the pipeline.
- budget_band: capture ranges or bands as said ("around €100k", "low six figures") — precision is not required.
- resell_interest: note any statements about how they buy GCP (direct, via reseller, open to change).
- openQuestions: list concrete gaps a human should clarify before partners are engaged.
- services: choose from: "Data Analytics", "Machine Learning", "Cloud Migration", "Generative AI", "App Modernization", "Security", "SAP", "DevOps", "Networking", "Data Lake", "Work Transformation".

Return ONLY a single JSON object matching the agreed schema — no prose, no code fences.`;
