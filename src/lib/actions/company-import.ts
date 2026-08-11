"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { insertRow, updateRows } from "@/lib/db";
import { anonymize, type CustomerRawProfile } from "@/lib/customer-profile";

const CompanyImportInput = z.object({
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

export const updateCompanyFromImportAction = defineAction({
  name: "company.profile.import",
  input: CompanyImportInput,
  permission: "onboarding.update",
  rateLimit: { scope: "company.profile.import", limit: 10, windowSec: 60 },
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

    // Map scraped partner data into CustomerRawProfile format
    const regionMap: Record<string, string> = {
      "north america": "North America",
      "emea": "EMEA",
      "apac": "APAC",
      "latam": "LATAM",
      "europe": "EMEA",
      "asia": "APAC",
      "africa": "EMEA",
      "middle east": "EMEA",
    };

    const inferRegion = (regions: string[], hq?: string): string => {
      for (const r of regions) {
        const key = r.toLowerCase().trim();
        if (regionMap[key]) return regionMap[key];
      }
      if (hq) {
        const hqLower = hq.toLowerCase();
        if (/usa|canada|united states|north america/.test(hqLower)) return "North America";
        if (/europe|germany|france|uk|spain|italy|netherlands|belgium|sweden|poland|emea/.test(hqLower)) return "EMEA";
        if (/asia|japan|china|india|singapore|australia|apac/.test(hqLower)) return "APAC";
        if (/latin|brazil|mexico|argentina|latam/.test(hqLower)) return "LATAM";
      }
      return "";
    };

    const inferSize = (teamSize?: string): string => {
      if (!teamSize) return "";
      const n = parseInt(teamSize.replace(/[^0-9]/g, ""), 10);
      if (isNaN(n)) return teamSize;
      if (n >= 10000) return "1000+";
      if (n >= 1000) return "1000+";
      if (n >= 500) return "501-1000";
      if (n >= 200) return "201-500";
      if (n >= 50) return "51-200";
      if (n >= 11) return "11-50";
      return "1-10";
    };

    const rawProfile: CustomerRawProfile = {
      fullName: "",
      role: "",
      seniority: "",
      headline: data.tagline || "",
      summary: data.description || "",
      company: {
        name: data.name || "",
        industry: data.industry || "",
        size: inferSize(data.teamSize),
        website: data.website || "",
        hq: data.headquarters || "",
        region: inferRegion(data.regions, data.headquarters),
      },
      expertise: [
        ...(data.expertiseAreas || []),
        ...(data.specializations || []),
        ...(data.serviceModels || []),
      ],
      pastProjects: (data.caseStudies || []).map((cs) =>
        [cs.title, cs.client && `for ${cs.client}`, cs.summary].filter(Boolean).join(" "),
      ),
      careerHighlights: [
        ...(data.differentiators || []),
        ...(data.awards || []).map((a) => `${a.title}${a.issuer ? ` (${a.issuer})` : ""}${a.year ? ` ${a.year}` : ""}`),
        ...(data.certifications || []).map((c) => `${c.count ? `${c.count}× ` : ""}${c.name}${c.level ? ` (${c.level})` : ""}`),
      ],
      goals: (data.industryExperience || []).map((ind) => `Serving the ${ind} industry`),
      contactHints: {
        email: "",
        phone: "",
        linkedin: "",
      },
    };

    const anonymized = anonymize(rawProfile);

    await insertRow(
      "CustomerProfile",
      { companyId: companyId! },
      {
        onConflict: `("companyId") DO UPDATE SET
          "rawProfile" = EXCLUDED."rawProfile",
          "anonymizedProfile" = EXCLUDED."anonymizedProfile",
          "lastExtractedAt" = EXCLUDED."lastExtractedAt",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    await updateRows("CustomerProfile", { companyId: companyId! }, {
      rawProfile: JSON.stringify(rawProfile),
      anonymizedProfile: JSON.stringify(anonymized),
      lastExtractedAt: new Date(),
    });

    revalidatePath("/settings/company");
    revalidatePath("/profile");
    return { ok: true as const };
  },
});
