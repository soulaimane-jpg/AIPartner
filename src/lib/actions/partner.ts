"use server";

/**
 * Partner-portal Server Actions.
 *
 * All wrapped in `defineAction` for validation/RBAC/rate-limit/audit.
 * The two **public** tokenised actions (`acceptPartnerTermsAction`,
 * `forwardOutreachAction`) use `permission: null` and gate themselves
 * via the outreach token alone.
 */

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, exec, insertRow, updateRows } from "@/lib/db";
import { PARTNER_TIER_VALUES } from "@/lib/enums";
import { renderPartnerOutreach } from "@/lib/email-templates";
import { sendOutreachEmail } from "@/lib/email/outreach";
import { transitionInvite } from "@/lib/state-machine/invite";
import { SYSTEM_ACTOR } from "@/lib/state-machine/transition";
import { satisfyTimer, startTimer } from "@/lib/timers";
import { getSetting } from "@/lib/settings";
import { notify, notifyAdmins } from "@/lib/notify";

// ─── Update partner profile ──────────────────────────────────────

const PartnerProfileInput = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  headquarters: z.string().optional(),
  teamSize: z.string().optional(),
  industry: z.string().optional(),
  languages: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  tier: z.enum(PARTNER_TIER_VALUES),
  specializations: z.array(z.string()).default([]),
  expertiseAreas: z.array(z.string()).default([]),
  awards: z
    .array(
      z.object({
        title: z.string().min(1),
        year: z.coerce.number().int(),
        issuer: z.string().optional(),
      }),
    )
    .default([]),
  directoryUrl: z.string().optional(),
  caseStudies: z
    .array(
      z.object({
        title: z.string(),
        client: z.string().optional().default(""),
        industry: z.string().optional().default(""),
        summary: z.string().optional().default(""),
        outcome: z.string().optional().default(""),
        link: z.string().optional().default(""),
      }),
    )
    .default([]),
  keyClients: z.array(z.string()).default([]),
  industryExperience: z.array(z.string()).default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        count: z.coerce.number().int().optional().default(0),
        level: z.string().optional().default(""),
      }),
    )
    .default([]),
  differentiators: z.array(z.string()).default([]),
  officeLocations: z.array(z.string()).default([]),
  serviceModels: z.array(z.string()).default([]),
  gcpTier: z.string().optional(),
  partnerSince: z.string().optional(),
  companyId: z.string().optional(),
});

export const updatePartnerProfileAction = defineAction({
  name: "partner.profile.update",
  input: PartnerProfileInput,
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.profile.update", limit: 30, windowSec: 60 },
  handler: async (data, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Partner company required" });
    }
    const companyId = ctx.user!.companyId!;

    await updateRows("Company", { id: companyId }, { name: data.name });

    const common = {
      tagline: data.tagline,
      description: data.description,
      website: data.website || null,
      headquarters: data.headquarters,
      teamSize: data.teamSize,
      industry: data.industry,
      languages: JSON.stringify(data.languages),
      regions: JSON.stringify(data.regions),
      tier: data.tier,
      specializations: JSON.stringify(data.specializations),
      expertiseAreas: JSON.stringify(data.expertiseAreas),
      awards: JSON.stringify(data.awards),
      directoryUrl: data.directoryUrl || null,
      caseStudies: JSON.stringify(data.caseStudies),
      keyClients: JSON.stringify(data.keyClients),
      industryExperience: JSON.stringify(data.industryExperience),
      certifications: JSON.stringify(data.certifications),
      differentiators: JSON.stringify(data.differentiators),
      officeLocations: JSON.stringify(data.officeLocations),
      serviceModels: JSON.stringify(data.serviceModels),
      gcpTier: data.gcpTier || null,
      partnerSince: data.partnerSince || null,
    };

    const setClauses = Object.keys(common)
      .map((k) => `"${k}" = EXCLUDED."${k}"`)
      .join(", ");
    await insertRow(
      "PartnerProfile",
      { companyId, ...common },
      {
        onConflict: `("companyId") DO UPDATE SET ${setClauses}, "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );
    revalidatePath("/partner/profile");
    revalidatePath("/partner");
    return { ok: true as const };
  },
});

// ─── Invite teammate ─────────────────────────────────────────────

const InviteTeammateInput = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  receiveBriefNotifications: z.coerce.boolean().optional(),
  companyId: z.string().optional(),
});

export const inviteTeammateAction = defineAction({
  name: "partner.team.invite",
  input: InviteTeammateInput,
  permission: "tenant.member.invite",
  rateLimit: { scope: "partner.team.invite", limit: 20, windowSec: 600 },
  handler: async ({ email, name }, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Partner company required" });
    }
    const normalized = email.trim().toLowerCase();

    const existing = await queryOne<{ id: string }>(
      'SELECT "id" FROM "User" WHERE "email" = $1',
      [normalized],
    );
    if (existing) {
      fail({
        code: "CONFLICT",
        reason: "A user with this email already exists.",
      });
    }

    // Placeholder hash — real flow emails a tokenised invite.
    const tempPassword = Math.random().toString(36).slice(2, 10) + "!A1";
    const hash = await bcrypt.hash(tempPassword, 10);
    await insertRow("User", {
      email: normalized,
      name: name ?? null,
      passwordHash: hash,
      role: "PARTNER",
      companyId: ctx.user!.companyId!,
    });
    revalidatePath("/partner/profile");
    return { ok: true as const };
  },
});

// ─── Public: tokenised T&C acceptance ────────────────────────────

const AcceptPartnerTermsInput = z.object({
  token: z.string().min(8),
  acceptedName: z.string().min(2).max(120),
  authorityChecked: z.coerce.boolean(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const acceptPartnerTermsAction = defineAction({
  name: "partner.terms.accept",
  input: AcceptPartnerTermsInput,
  output: z.object({ briefId: z.string(), matchId: z.string() }),
  permission: null, // Tokenised public action
  rateLimit: { scope: "partner.terms.accept", limit: 10, windowSec: 60 },
  handler: async ({
    token,
    acceptedName,
    authorityChecked,
    ipAddress,
    userAgent,
  }) => {
    if (!authorityChecked) {
      fail({
        code: "INVALID_INPUT",
        issues: [
          {
            path: "authorityChecked",
            message:
              "Please confirm you have authority to accept on behalf of the company.",
          },
        ],
      });
    }

    const match = await queryOne<{
      id: string;
      briefId: string;
      partnerId: string;
      status: string;
      acceptedTermsAt: Date | null;
      acceptDeadlineAt: Date | null;
      outreachEmail: string | null;
      briefTitle: string;
      partnerName: string;
    }>(
      `SELECT m."id", m."briefId", m."partnerId", m."status", m."acceptedTermsAt",
              m."acceptDeadlineAt", m."outreachEmail",
              b."title" AS "briefTitle", c."name" AS "partnerName"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       JOIN "Company" c ON c."id" = m."partnerId"
       WHERE m."outreachToken" = $1`,
      [token],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Outreach link" });
    if (match!.acceptedTermsAt) {
      // Idempotent — already accepted.
      return { briefId: match!.briefId, matchId: match!.id };
    }

    // The emailed link is not a way around T1: the authenticated path
    // enforces the acceptance window, so this one must too.
    if (match!.acceptDeadlineAt && match!.acceptDeadlineAt < new Date()) {
      fail({ code: "CONFLICT", reason: "The acceptance window has passed" });
    }

    const acceptedBy = (match!.outreachEmail ?? "").toLowerCase();

    // T2 starts now, exactly as it does for an authenticated accept.
    const timer = await queryOne<{ meta: string | null }>(
      `SELECT "meta" FROM "TimerInstance"
       WHERE "entityType" = 'match' AND "entityId" = $1
         AND "timerType" = 'lead_accept' AND "status" = 'active'
       LIMIT 1`,
      [match!.id],
    );
    let proposalHours = await getSetting("proposal_submit_hours");
    try {
      const meta = JSON.parse(timer?.meta ?? "{}") as {
        proposalHoursOverride?: number | null;
      };
      if (meta.proposalHoursOverride) proposalHours = meta.proposalHoursOverride;
    } catch {
      /* default stands */
    }
    const proposalDeadline = new Date(Date.now() + proposalHours * 3_600_000);

    // Go through the invite state machine so the acceptance is audited
    // with a from-state, like every other transition.
    await transitionInvite({
      matchId: match!.id,
      to: "PARTNER_ACCEPTED",
      actor: SYSTEM_ACTOR,
      reason: `Accepted via emailed outreach link by ${acceptedName}`,
      data: {
        acceptedTermsAt: new Date(),
        acceptedTermsBy: acceptedBy || null,
        acceptedTermsName: acceptedName,
        acceptedTermsIp: ipAddress ?? null,
        acceptedTermsUa: userAgent ?? null,
        proposalDeadlineAt: proposalDeadline,
      },
    });

    await exec(
      `UPDATE "PartnerProfile" SET
         "acceptedTermsAt" = NOW(),
         "acceptedTermsBy" = $2,
         "acceptedTermsName" = $3,
         "updatedAt" = NOW()
       WHERE "companyId" = $1 AND "acceptedTermsAt" IS NULL`,
      [match!.partnerId, acceptedBy || null, acceptedName],
    );

    await satisfyTimer("match", match!.id, "lead_accept");
    await startTimer({
      entityType: "match",
      entityId: match!.id,
      timerType: "proposal_submit",
      deadlineAt: proposalDeadline,
      meta: { briefId: match!.briefId, matchId: match!.id },
    });

    await notifyAdmins({
      event: "partner.accepted_admin",
      vars: {
        briefTitle: match!.briefTitle,
        partnerName: match!.partnerName,
        acceptedName,
      },
      link: `/admin/briefs/${match!.briefId}`,
      briefId: match!.briefId,
      matchId: match!.id,
      idemKey: `accepted:${match!.id}`,
    });

    // Confirm to the partner contact who just signed — previously this
    // was the one acceptance path that sent them nothing at all.
    if (acceptedBy) {
      await notify({
        event: "partner.accepted_confirmation",
        recipients: [{ email: acceptedBy }],
        vars: {
          briefTitle: match!.briefTitle,
          proposalDeadline: proposalDeadline.toUTCString(),
        },
        link: `/partner/briefs/${match!.briefId}`,
        briefId: match!.briefId,
        matchId: match!.id,
        idemKey: `accept-confirm:${match!.id}`,
      });
    }

    revalidatePath(`/admin/briefs/${match!.briefId}`);
    revalidatePath(`/briefs/${match!.briefId}/shortlist`);

    return { briefId: match!.briefId, matchId: match!.id };
  },
});

// ─── Public: forward outreach to a colleague ─────────────────────

const ForwardOutreachInput = z.object({
  token: z.string().min(8),
  newEmail: z.string().email(),
  newName: z.string().optional(),
  note: z.string().max(500).optional(),
});

export const forwardOutreachAction = defineAction({
  name: "partner.outreach.forward",
  input: ForwardOutreachInput,
  output: z.object({ newAcceptUrl: z.string() }),
  permission: null, // Tokenised public action
  rateLimit: { scope: "partner.outreach.forward", limit: 5, windowSec: 60 },
  handler: async ({ token, newEmail, newName, note }) => {
    const match = await queryOne<{
      id: string;
      briefId: string;
      partnerId: string;
      acceptedTermsAt: Date | null;
      outreachEmail: string | null;
      briefTitle: string;
      briefSummary: string | null;
      briefRegion: string | null;
      partnerName: string;
      anonymizedProfile: string | null;
    }>(
      `SELECT m."id", m."briefId", m."partnerId", m."acceptedTermsAt", m."outreachEmail",
              b."title" AS "briefTitle",
              b."executiveSummary" AS "briefSummary",
              b."preferredLocation" AS "briefRegion",
              c."name" AS "partnerName",
              cp."anonymizedProfile"
       FROM "Match" m
       JOIN "ProjectBrief" b ON b."id" = m."briefId"
       JOIN "Company" c ON c."id" = m."partnerId"
       LEFT JOIN "CustomerProfile" cp ON cp."companyId" = b."companyId"
       WHERE m."outreachToken" = $1`,
      [token],
    );
    if (!match) fail({ code: "NOT_FOUND", resource: "Outreach link" });
    if (match!.acceptedTermsAt) {
      fail({
        code: "CONFLICT",
        reason: "This lead has already been accepted — no need to forward.",
      });
    }

    const newToken = crypto.randomBytes(24).toString("hex");

    let customerIndustry = "Not specified";
    let customerRegion = match!.briefRegion ?? "Not specified";
    try {
      const anon = JSON.parse(match!.anonymizedProfile ?? "{}");
      if (anon?.industry) customerIndustry = String(anon.industry);
      if (anon?.region) customerRegion = String(anon.region);
    } catch {
      /* ignore */
    }

    const acceptUrl = `https://aipartner.cloud/partner/accept/${newToken}`;
    const rendered = renderPartnerOutreach({
      partnerName: newName ?? match!.partnerName,
      partnerCompany: match!.partnerName,
      recipientEmail: newEmail,
      customerIndustry,
      customerRegion,
      briefSummary:
        match!.briefSummary?.trim().slice(0, 1000) ??
        "Detailed scope will be shared upon acceptance of the lead terms.",
      briefTitle: match!.briefTitle,
      acceptUrl,
    });

    const forwardedFrom = match!.outreachEmail;

    await updateRows(
      "Match",
      { id: match!.id },
      {
        outreachToken: newToken,
        outreachEmail: newEmail.toLowerCase(),
        forwardedFromEmail: forwardedFrom,
        outreachSentAt: new Date(),
      },
    );

    await sendOutreachEmail({
      matchId: match!.id,
      recipientEmail: newEmail.toLowerCase(),
      subject: rendered.subject,
      body:
        (note
          ? `Forwarded by ${forwardedFrom ?? "your colleague"}:\n  "${note}"\n\n`
          : "") + rendered.body,
      notification: {
        type: "partner.outreach.forwarded",
        title: "An AI Partner opportunity was forwarded to you",
        message: `${forwardedFrom ?? "A colleague"} forwarded a lead for "${match!.briefTitle}".`,
        link: `/partner/accept/${newToken}`,
      },
    });

    return { newAcceptUrl: `/partner/accept/${newToken}` };
  },
});

// ─── Update lead-routing email ──────────────────────────────────

const LeadRoutingInput = z.object({
  leadRoutingEmail: z.string().email().or(z.literal("")),
  companyId: z.string().optional(),
});

export const updateLeadRoutingEmailAction = defineAction({
  name: "partner.lead-routing.update",
  input: LeadRoutingInput,
  permission: "partner.profile.update",
  rateLimit: { scope: "partner.lead-routing.update", limit: 30, windowSec: 60 },
  handler: async ({ leadRoutingEmail }, ctx) => {
    if (!ctx.user?.companyId) {
      fail({ code: "FORBIDDEN", reason: "Partner company required" });
    }
    const companyId = ctx.user!.companyId!;

    await insertRow(
      "PartnerProfile",
      {
        companyId,
        leadRoutingEmail: leadRoutingEmail || null,
      },
      {
        onConflict: `("companyId") DO UPDATE SET
          "leadRoutingEmail" = EXCLUDED."leadRoutingEmail",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    revalidatePath("/partner/profile");
    revalidatePath("/partner");
    return { ok: true as const };
  },
});
