"use server";

/**
 * M8 — proposal QC, anonymization review, comparison build & release
 * (plan-A §6 M8a–M8c).
 *
 * Flow per proposal: SUBMITTED → IN_QC → (CLARIFICATION_NEEDED ⇄
 * IN_QC) → QC_PASSED → LLM anonymization pass → human diff review →
 * approved. The comparison releases columns in submission order via
 * the stagger engine (`src/lib/comparison/release.ts`).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { query, queryOne, insertRow, updateRows, tx } from "@/lib/db";
import { transitionProposal } from "@/lib/state-machine/proposal";
import { transitionInvite } from "@/lib/state-machine/invite";
import { transitionLead, getLeadState } from "@/lib/state-machine/lead";
import { userActor } from "@/lib/state-machine/transition";
import { runAnonymizationPass } from "@/lib/anonymize";
import { releaseComparison } from "@/lib/comparison/release";
import { getSetting } from "@/lib/settings";
import { startTimer } from "@/lib/timers";
import { notify, notifyCompanyUsers } from "@/lib/notify";
import { PROPOSAL_SECTION_KEYS } from "@/lib/sections";

// ─── QC start ─────────────────────────────────────────────────

const StartQcInput = z.object({ proposalId: z.string().min(1) });

export const adminStartQcAction = defineAction({
  name: "admin.qc.start",
  input: StartQcInput,
  permission: "admin.qc",
  rateLimit: { scope: "admin.qc.start", limit: 60, windowSec: 60 },
  handler: async ({ proposalId }, ctx) => {
    await transitionProposal({
      proposalId,
      to: "IN_QC",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    const proposal = await queryOne<{ briefId: string }>(
      'SELECT "briefId" FROM "Proposal" WHERE "id" = $1',
      [proposalId],
    );
    if (proposal) revalidatePath(`/admin/briefs/${proposal.briefId}`);
    return { ok: true as const };
  },
});

// ─── QC clarification (loops to the partner) ──────────────────

const QcClarifyInput = z.object({
  proposalId: z.string().min(1),
  body: z.string().min(3).max(10_000),
  anchorSectionKey: z.string().optional(),
});

export const adminQcClarificationAction = defineAction({
  name: "admin.qc.clarify",
  input: QcClarifyInput,
  output: z.object({ threadId: z.string() }),
  permission: "admin.qc",
  rateLimit: { scope: "admin.qc.clarify", limit: 30, windowSec: 300 },
  handler: async ({ proposalId, body, anchorSectionKey }, ctx) => {
    const proposal = await queryOne<{
      id: string;
      briefId: string;
      matchId: string;
      partnerId: string;
      briefTitle: string;
    }>(
      `SELECT p."id", p."briefId", p."matchId", p."partnerId",
              b."title" AS "briefTitle"
       FROM "Proposal" p
       JOIN "ProjectBrief" b ON b."id" = p."briefId"
       WHERE p."id" = $1`,
      [proposalId],
    );
    if (!proposal) fail({ code: "NOT_FOUND", resource: "Proposal" });

    await transitionProposal({
      proposalId,
      to: "CLARIFICATION_NEEDED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });

    const thread = await tx(async (client) => {
      const t = await insertRow<{ id: string }>(
        "ClarificationThread",
        {
          contextType: "proposal_qc",
          briefId: proposal!.briefId,
          matchId: proposal!.matchId,
          proposalId,
          anchorSectionKey: anchorSectionKey ?? null,
          status: "awaiting_partner",
          createdById: ctx.user!.id,
        },
        { client },
      );
      await insertRow(
        "ClarificationMessage",
        {
          threadId: t.id,
          authorId: ctx.user!.id,
          authorRole: "admin",
          kind: "text",
          body,
        },
        { client },
      );
      return t;
    });

    const partnerUsers = await query<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "companyId" = $1',
      [proposal!.partnerId],
    );
    await notify({
      event: "qc.clarification",
      recipients: partnerUsers.map((u) => ({ userId: u.id })),
      vars: {
        briefTitle: proposal!.briefTitle,
        preview: body.slice(0, 300),
      },
      link: `/partner/briefs/${proposal!.briefId}`,
      briefId: proposal!.briefId,
      matchId: proposal!.matchId,
      idemKey: `qc-clarify:${thread.id}`,
    });

    revalidatePath(`/admin/briefs/${proposal!.briefId}`);
    return { threadId: thread.id };
  },
});

// ─── Partner resubmits after clarification ────────────────────
// (handled via proposal-builder save + this admin action to move it
// back to IN_QC once answers arrive)

const QcResumeInput = z.object({ proposalId: z.string().min(1) });

export const adminResumeQcAction = defineAction({
  name: "admin.qc.resume",
  input: QcResumeInput,
  permission: "admin.qc",
  rateLimit: { scope: "admin.qc.resume", limit: 60, windowSec: 60 },
  handler: async ({ proposalId }, ctx) => {
    await transitionProposal({
      proposalId,
      to: "IN_QC",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });
    const proposal = await queryOne<{ briefId: string }>(
      'SELECT "briefId" FROM "Proposal" WHERE "id" = $1',
      [proposalId],
    );
    if (proposal) revalidatePath(`/admin/briefs/${proposal.briefId}`);
    return { ok: true as const };
  },
});

// ─── QC pass → anonymization pass ─────────────────────────────

const QcPassInput = z.object({ proposalId: z.string().min(1) });

export const adminQcPassAction = defineAction({
  name: "admin.qc.pass",
  input: QcPassInput,
  output: z.object({ anonymizationQueued: z.boolean() }),
  permission: "admin.qc",
  rateLimit: { scope: "admin.qc.pass", limit: 30, windowSec: 60 },
  handler: async ({ proposalId }, ctx) => {
    const proposal = await queryOne<{
      id: string;
      briefId: string;
      matchId: string;
    }>(
      'SELECT "id", "briefId", "matchId" FROM "Proposal" WHERE "id" = $1',
      [proposalId],
    );
    if (!proposal) fail({ code: "NOT_FOUND", resource: "Proposal" });

    await transitionProposal({
      proposalId,
      to: "QC_PASSED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
      data: { qcPassedAt: new Date() },
    });
    await transitionInvite({
      matchId: proposal!.matchId,
      to: "QC_PASSED",
      actor: userActor(ctx.user!.id, ctx.user!.companyId),
    });

    // Kick the anonymization pass — failure is non-fatal (re-runnable
    // from the anonymization queue).
    const pass = await runAnonymizationPass(proposalId);

    revalidatePath(`/admin/briefs/${proposal!.briefId}`);
    revalidatePath("/admin/anonymization");
    return { anonymizationQueued: pass.ok };
  },
});

// ─── Re-run anonymization ─────────────────────────────────────

const RerunAnonInput = z.object({ proposalId: z.string().min(1) });

export const adminRerunAnonymizationAction = defineAction({
  name: "admin.anonymization.rerun",
  input: RerunAnonInput,
  permission: "admin.anonymization.review",
  rateLimit: { scope: "admin.anon.rerun", limit: 20, windowSec: 300 },
  handler: async ({ proposalId }) => {
    const pass = await runAnonymizationPass(proposalId);
    if (!pass.ok) fail({ code: "LLM_FAILURE", retryable: true });
    revalidatePath("/admin/anonymization");
    return { ok: true as const };
  },
});

// ─── Human anonymization review (approve w/ edits) ────────────

const ReviewAnonInput = z.object({
  anonymizedProposalId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  /** Reviewer-edited section content (overrides the LLM output). */
  editedSections: z.record(z.string(), z.string()).optional(),
  reviewerNotes: z.string().max(5000).optional(),
});

export const adminReviewAnonymizationAction = defineAction({
  name: "admin.anonymization.review",
  input: ReviewAnonInput,
  permission: "admin.anonymization.review",
  rateLimit: { scope: "admin.anon.review", limit: 60, windowSec: 60 },
  handler: async (
    { anonymizedProposalId, decision, editedSections, reviewerNotes },
    ctx,
  ) => {
    const row = await queryOne<{
      id: string;
      content: string;
      briefId: string;
      partnerName: string;
    }>(
      `SELECT ap."id", ap."content", p."briefId", c."name" AS "partnerName"
       FROM "AnonymizedProposal" ap
       JOIN "Proposal" p ON p."id" = ap."proposalId"
       JOIN "Company" c ON c."id" = p."partnerId"
       WHERE ap."id" = $1`,
      [anonymizedProposalId],
    );
    if (!row) fail({ code: "NOT_FOUND", resource: "AnonymizedProposal" });

    let content = row!.content;
    if (editedSections && Object.keys(editedSections).length > 0) {
      let existing: Record<string, string> = {};
      try {
        existing = JSON.parse(row!.content) as Record<string, string>;
      } catch {
        existing = {};
      }
      for (const [key, value] of Object.entries(editedSections)) {
        if ((PROPOSAL_SECTION_KEYS as readonly string[]).includes(key)) {
          existing[key] = value;
        }
      }
      content = JSON.stringify(existing);
    }

    // Approval guard: partner name must not appear in the final text.
    if (decision === "approved") {
      const partnerName = row!.partnerName.trim().toLowerCase();
      if (partnerName.length > 2 && content.toLowerCase().includes(partnerName)) {
        fail({
          code: "CONFLICT",
          reason: "The approved text still contains the partner name",
        });
      }
    }

    await updateRows(
      "AnonymizedProposal",
      { id: anonymizedProposalId },
      {
        content,
        status: decision,
        reviewerNotes: reviewerNotes ?? null,
        humanReviewedBy: ctx.user!.id,
        humanReviewedAt: new Date(),
      },
    );

    revalidatePath("/admin/anonymization");
    revalidatePath(`/admin/briefs/${row!.briefId}`);
    return { ok: true as const };
  },
});

// ─── Build + release the comparison ───────────────────────────

const BuildComparisonInput = z.object({ briefId: z.string().min(1) });

export const adminBuildComparisonAction = defineAction({
  name: "admin.comparison.build",
  input: BuildComparisonInput,
  output: z.object({ columns: z.number() }),
  permission: "admin.comparison.release",
  rateLimit: { scope: "admin.comparison.build", limit: 30, windowSec: 60 },
  handler: async ({ briefId }) => {
    // Eligible: QC-passed proposals with an approved anonymization.
    const proposals = await query<{
      id: string;
      matchId: string;
      matchPlaceholderLabel: string | null;
      anonPlaceholderLabel: string;
      anonContent: string;
    }>(
      `SELECT p."id", p."matchId",
              m."placeholderLabel" AS "matchPlaceholderLabel",
              ap."placeholderLabel" AS "anonPlaceholderLabel",
              ap."content" AS "anonContent"
       FROM "Proposal" p
       JOIN "AnonymizedProposal" ap ON ap."proposalId" = p."id"
       JOIN "Match" m ON m."id" = p."matchId"
       WHERE p."briefId" = $1 AND p."qcPassedAt" IS NOT NULL
         AND ap."status" = 'approved'
       ORDER BY p."submittedAt" ASC`,
      [briefId],
    );
    if (proposals.length === 0) {
      fail({
        code: "CONFLICT",
        reason: "No QC-passed, anonymization-approved proposals yet",
      });
    }

    const view = await insertRow<{ id: string }>(
      "ComparisonView",
      { briefId, status: "draft" },
      {
        // No-op update so RETURNING gives us the existing row.
        onConflict: `("briefId") DO UPDATE SET "briefId" = EXCLUDED."briefId"`,
      },
    );

    let rank = 0;
    for (const proposal of proposals) {
      rank++;
      const label =
        proposal.matchPlaceholderLabel ?? proposal.anonPlaceholderLabel;

      const column = await queryOne<{ id: string }>(
        `SELECT "id" FROM "ComparisonColumn"
         WHERE "viewId" = $1 AND "matchId" = $2
         LIMIT 1`,
        [view.id, proposal.matchId],
      );
      if (column) {
        await updateRows(
          "ComparisonColumn",
          { id: column.id },
          { submissionRank: rank, placeholderLabel: label },
        );
      } else {
        await insertRow("ComparisonColumn", {
          viewId: view.id,
          matchId: proposal.matchId,
          placeholderLabel: label,
          submissionRank: rank,
        });
      }

      // Cells from the approved anonymized sections.
      let sections: Record<string, string> = {};
      try {
        sections = JSON.parse(proposal.anonContent) as Record<string, string>;
      } catch {
        sections = {};
      }
      for (const [sectionKey, detail] of Object.entries(sections)) {
        const summary =
          detail.length > 280 ? `${detail.slice(0, 277)}…` : detail;
        await insertRow(
          "ComparisonCell",
          {
            viewId: view.id,
            placeholderLabel: label,
            sectionKey,
            summary,
            detail,
          },
          {
            onConflict: `("viewId", "placeholderLabel", "sectionKey") DO UPDATE SET
              "summary" = EXCLUDED."summary",
              "detail" = EXCLUDED."detail",
              "updatedAt" = EXCLUDED."updatedAt"`,
          },
        );
      }
    }

    revalidatePath(`/admin/briefs/${briefId}`);
    return { columns: proposals.length };
  },
});

const ReleaseComparisonInput = z.object({ briefId: z.string().min(1) });

export const adminReleaseComparisonAction = defineAction({
  name: "admin.comparison.release",
  input: ReleaseComparisonInput,
  output: z.object({ releasedNow: z.number(), pending: z.number() }),
  permission: "admin.comparison.release",
  rateLimit: { scope: "admin.comparison.release", limit: 20, windowSec: 60 },
  handler: async ({ briefId }, ctx) => {
    const brief = await queryOne<{
      id: string;
      title: string;
      companyId: string;
    }>(
      'SELECT "id", "title", "companyId" FROM "ProjectBrief" WHERE "id" = $1',
      [briefId],
    );
    if (!brief) fail({ code: "NOT_FOUND", resource: "Brief" });

    const result = await releaseComparison(briefId, ctx.user!.id);

    // Lead transition + company selection window (M10.3).
    const state = await getLeadState(briefId);
    if (state === "PROPOSALS_IN_REVIEW") {
      await transitionLead({
        briefId,
        to: "COMPARISON_RELEASED",
        actor: userActor(ctx.user!.id, ctx.user!.companyId),
      });

      const selectHours = await getSetting("company_select_hours");
      const deadline = new Date(Date.now() + selectHours * 3_600_000);
      await updateRows(
        "ProjectBrief",
        { id: briefId },
        { selectionDeadlineAt: deadline },
      );
      await startTimer({
        entityType: "brief",
        entityId: briefId,
        timerType: "company_select",
        deadlineAt: deadline,
        meta: { briefId },
      });

      await notifyCompanyUsers(brief!.companyId, {
        event: "comparison.released",
        vars: {
          briefTitle: brief!.title,
          selectHours: String(selectHours),
        },
        link: `/briefs/${briefId}/compare`,
        briefId,
        idemKey: `comparison-released:${briefId}`,
      });
    }

    revalidatePath(`/admin/briefs/${briefId}`);
    revalidatePath(`/briefs/${briefId}/compare`);
    return result;
  },
});
