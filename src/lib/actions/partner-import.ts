"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { updateRows } from "@/lib/db";

const PartnerImportInput = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  headquarters: z.string().optional(),
  teamSize: z.string().optional(),
  industry: z.string().optional(),
  gcpTier: z.string().optional(),
  partnerSince: z.string().optional(),
  languages: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  officeLocations: z.array(z.string()).default([]),
  serviceModels: z.array(z.string()).default([]),
  specializations: z.array(z.string()).default([]),
  expertiseAreas: z.array(z.string()).default([]),
  industryExperience: z.array(z.string()).default([]),
  keyClients: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        count: z.coerce.number().int().optional().default(0),
        level: z.string().optional().default(""),
      }),
    )
    .default([]),
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
  awards: z
    .array(
      z.object({
        title: z.string(),
        year: z.coerce.number().int(),
        issuer: z.string().optional(),
      }),
    )
    .default([]),
  sourceUrl: z.string().optional(),
});

export const updatePartnerFromImportAction = defineAction({
  name: "partner.profile.import",
  input: PartnerImportInput,
  permission: "onboarding.update",
  rateLimit: { scope: "partner.profile.import", limit: 10, windowSec: 60 },
  handler: async (data, ctx) => {
    const companyId = ctx.user?.companyId;
    if (!companyId) {
      fail({ code: "FORBIDDEN", reason: "Company membership required" });
    }

    const companyPatch: Record<string, unknown> = {};
    if (data.name) companyPatch.name = data.name;
    if (data.website) companyPatch.website = data.website;
    if (data.industry) companyPatch.industry = data.industry;

    if (Object.keys(companyPatch).length > 0) {
      await updateRows("Company", { id: companyId! }, companyPatch);
    }

    const profilePatch: Record<string, unknown> = {};

    if (data.tagline) profilePatch.tagline = data.tagline;
    if (data.description) profilePatch.description = data.description;
    if (data.website) profilePatch.website = data.website;
    if (data.headquarters) profilePatch.headquarters = data.headquarters;
    if (data.teamSize) profilePatch.teamSize = data.teamSize;
    if (data.industry) profilePatch.industry = data.industry;
    if (data.gcpTier) profilePatch.gcpTier = data.gcpTier;
    if (data.partnerSince) profilePatch.partnerSince = data.partnerSince;
    if (data.sourceUrl) profilePatch.directoryUrl = data.sourceUrl;

    if (data.languages?.length) profilePatch.languages = JSON.stringify(data.languages);
    if (data.regions?.length) profilePatch.regions = JSON.stringify(data.regions);
    if (data.officeLocations?.length) profilePatch.officeLocations = JSON.stringify(data.officeLocations);
    if (data.serviceModels?.length) profilePatch.serviceModels = JSON.stringify(data.serviceModels);
    if (data.specializations?.length) profilePatch.specializations = JSON.stringify(data.specializations);
    if (data.expertiseAreas?.length) profilePatch.expertiseAreas = JSON.stringify(data.expertiseAreas);
    if (data.industryExperience?.length) profilePatch.industryExperience = JSON.stringify(data.industryExperience);
    if (data.keyClients?.length) profilePatch.keyClients = JSON.stringify(data.keyClients);
    if (data.differentiators?.length) profilePatch.differentiators = JSON.stringify(data.differentiators);
    if (data.certifications?.length) profilePatch.certifications = JSON.stringify(data.certifications);
    if (data.caseStudies?.length) profilePatch.caseStudies = JSON.stringify(data.caseStudies);
    if (data.awards?.length) profilePatch.awards = JSON.stringify(data.awards);

    if (Object.keys(profilePatch).length > 0) {
      await updateRows("PartnerProfile", { companyId: companyId! }, profilePatch);
    }

    revalidatePath("/partner/profile");
    revalidatePath("/partner");
    return { ok: true as const };
  },
});
