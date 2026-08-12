/**
 * M8b — LLM anonymization pass over a submitted proposal (plan-A §8
 * Layer 2). The model rewrites each section replacing partner- and
 * client-identifying entities with neutral placeholders and reports
 * every replacement so a human reviewer can check for BOTH misses and
 * over-redactions. LLM output NEVER reaches the customer without
 * human approval (§4.2).
 */

import "server-only";
import { z } from "zod";
import { query, queryOne, insertRow } from "@/lib/db";
import type { AnonymizedProposalRow } from "@/lib/db/rows";
import { parseLlmJson } from "@/lib/ai/parse";
import { fenceUntrusted } from "@/lib/ai/untrusted";
import { PROPOSAL_SECTION_KEYS } from "@/lib/sections";

export const ANONYMIZE_PROMPT_VERSION = "anonymize-v1";

const AnonymizationResultV1 = z.object({
  sections: z.record(z.string(), z.string()),
  replacements: z
    .array(
      z.object({
        original: z.string(),
        replacement: z.string(),
        entityType: z.string(), // company | person | client | product | url | location | other
      }),
    )
    .default([]),
  detectedEntities: z.array(z.string()).default([]),
});
export type AnonymizationResultV1 = z.infer<typeof AnonymizationResultV1>;

const ANONYMIZE_SYSTEM = `You are AIPartner's anonymization engine. You receive the sections of a partner's proposal. The customer must NOT be able to identify which partner wrote it.

Rewrite every section so that:
- The partner's company name, brand, product names, staff names, emails, URLs and office locations are replaced with neutral placeholders ("the partner", "a senior architect", "[reference client]").
- Named reference clients become industry descriptions ("a European retail group", "a DAX-listed manufacturer").
- Numbers, prices, timelines, methodologies and technical content stay EXACTLY as written — do not soften or summarize.
- Keep formatting (line breaks, lists) intact.

Report EVERY replacement you make in the "replacements" array (original → replacement, entityType one of: company, person, client, product, url, location, other). If a section needs no changes, return it unchanged.

Return ONLY a single JSON object:
{
  "sections": { "<sectionKey>": "<anonymized content>", ... },
  "replacements": [{ "original": "...", "replacement": "...", "entityType": "..." }],
  "detectedEntities": ["..."]
}`;

export interface AnonymizeOutcome {
  ok: boolean;
  anonymizedProposalId?: string;
  error?: string;
}

/**
 * Run (or re-run) the anonymization pass for a proposal and store the
 * result as `pending_review`. Partner identity context is passed so
 * the model knows exactly which entity names to strip.
 */
export async function runAnonymizationPass(
  proposalId: string,
): Promise<AnonymizeOutcome> {
  const proposal = await queryOne<{
    id: string;
    partnerName: string;
    partnerWebsite: string | null;
    placeholderLabel: string | null;
  }>(
    `SELECT p."id", c."name" AS "partnerName", c."website" AS "partnerWebsite",
            m."placeholderLabel"
     FROM "Proposal" p
     JOIN "Company" c ON c."id" = p."partnerId"
     JOIN "Match" m ON m."id" = p."matchId"
     WHERE p."id" = $1`,
    [proposalId],
  );
  if (!proposal) return { ok: false, error: "Proposal not found" };
  const sectionsRows = await query<{ key: string; content: string }>(
    'SELECT "key", "content" FROM "ProposalSection" WHERE "proposalId" = $1 ORDER BY "rank" ASC',
    [proposalId],
  );

  const label = proposal.placeholderLabel ?? "Partner ?";
  const sectionInput: Record<string, string> = {};
  for (const s of sectionsRows) {
    if (s.content.trim()) sectionInput[s.key] = s.content;
  }
  if (Object.keys(sectionInput).length === 0) {
    return { ok: false, error: "Proposal has no section content" };
  }

  const result = await parseLlmJson({
    schema: AnonymizationResultV1,
    system: ANONYMIZE_SYSTEM,
    user: [
      `# Partner identity to strip`,
      `Company name: ${proposal.partnerName}`,
      proposal.partnerWebsite ? `Website: ${proposal.partnerWebsite}` : "",
      ``,
      `# Proposal sections (JSON)`,
      // Partner-authored text whose whole purpose here is to have its
      // identity removed — so it is exactly the text most motivated to
      // talk the model out of doing that.
      fenceUntrusted(JSON.stringify(sectionInput, null, 2), {
        source: "partner proposal sections",
      }),
    ]
      .filter(Boolean)
      .join("\n"),
    untrustedInput: true,
    tag: "anonymize-proposal",
    maxTokens: 6000,
    temperature: 0,
    timeoutMs: 60_000,
  });

  if (!result.ok) {
    return { ok: false, error: `LLM pass failed: ${result.error.code}` };
  }

  // Belt-and-braces: reject the pass outright if the partner name
  // survived in any section (§8 — better to block than leak).
  const partnerName = proposal.partnerName.trim().toLowerCase();
  const leaked = Object.values(result.data.sections).some(
    (content) =>
      partnerName.length > 2 && content.toLowerCase().includes(partnerName),
  );
  if (leaked) {
    return {
      ok: false,
      error: "Anonymization pass left the partner name in the output — re-run",
    };
  }

  // Only keep canonical keys.
  const sections: Record<string, string> = {};
  for (const key of PROPOSAL_SECTION_KEYS) {
    if (result.data.sections[key]) sections[key] = result.data.sections[key];
  }

  const row = await insertRow<AnonymizedProposalRow>(
    "AnonymizedProposal",
    {
      proposalId,
      placeholderLabel: label,
      content: JSON.stringify(sections),
      replacedEntities: JSON.stringify(result.data.replacements),
      llmPassMetadata: JSON.stringify({
        promptVersion: ANONYMIZE_PROMPT_VERSION,
        detectedEntities: result.data.detectedEntities,
      }),
      promptVer: ANONYMIZE_PROMPT_VERSION,
      status: "pending_review",
    },
    {
      onConflict: `("proposalId") DO UPDATE SET
        "placeholderLabel" = EXCLUDED."placeholderLabel",
        "content" = EXCLUDED."content",
        "replacedEntities" = EXCLUDED."replacedEntities",
        "llmPassMetadata" = EXCLUDED."llmPassMetadata",
        "promptVer" = EXCLUDED."promptVer",
        "status" = 'pending_review',
        "humanReviewedBy" = NULL,
        "humanReviewedAt" = NULL,
        "updatedAt" = EXCLUDED."updatedAt"`,
    },
  );

  return { ok: true, anonymizedProposalId: row.id };
}
