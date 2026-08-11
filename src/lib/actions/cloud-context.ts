"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { genId, queryOne } from "@/lib/db";
import { deriveCloudContext, type CloudProvider } from "@/lib/cloud-context";

const providerKeys = ["gcp", "aws", "azure", "other"] as const;
const statusValues = ["yes", "no", "unknown"] as const;

export async function saveCloudContextAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");

  const providers: CloudProvider[] = [];
  for (const provider of providerKeys) {
    if (formData.get(`provider_${provider}`) === "on") {
      providers.push({ provider, spendBand: String(formData.get(`spend_${provider}`) || "prefer_not_to_share") });
    }
  }
  const parsed = z.object({
    resellerStatus: z.enum(statusValues),
    resellerWebsite: z.string().trim().url().or(z.literal("")).optional(),
    agreementStatus: z.enum(statusValues),
    agreementStartDate: z.string().optional(),
    agreementEndDate: z.string().optional(),
    minimumCommitmentUsd: z.coerce.number().nonnegative().optional().or(z.nan()),
    discountPct: z.coerce.number().min(0).max(100).optional().or(z.nan()),
  }).safeParse({
    resellerStatus: formData.get("resellerStatus") || "unknown",
    resellerWebsite: normalizeUrl(String(formData.get("resellerWebsite") || "")),
    agreementStatus: formData.get("agreementStatus") || "unknown",
    agreementStartDate: formData.get("agreementStartDate") || undefined,
    agreementEndDate: formData.get("agreementEndDate") || undefined,
    minimumCommitmentUsd: formData.get("minimumCommitmentUsd") || undefined,
    discountPct: formData.get("discountPct") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the cloud context details");

  const agreementStartDate = parseMonth(parsed.data.agreementStartDate);
  const agreementEndDate = parseMonth(parsed.data.agreementEndDate);
  const derived = deriveCloudContext(providers, agreementEndDate);
  const existing = await queryOne<{ id: string; version: number }>(
    'SELECT "id", "version" FROM "CompanyCloudContext" WHERE "companyId" = $1',
    [session.user.companyId],
  );
  const values = [
    existing?.id ?? genId(), session.user.companyId, JSON.stringify(providers), parsed.data.resellerStatus,
    parsed.data.resellerWebsite || null, parsed.data.agreementStatus, agreementStartDate, agreementEndDate,
    numericOrNull(parsed.data.minimumCommitmentUsd), numericOrNull(parsed.data.discountPct),
    derived.gcpGreenfield, derived.renewalWindow, existing ? existing.version + 1 : 1,
  ];
  await queryOne(
    `INSERT INTO "CompanyCloudContext"
       ("id", "companyId", "providers", "resellerStatus", "resellerWebsite", "agreementStatus", "agreementStartDate", "agreementEndDate", "minimumCommitmentUsd", "discountPct", "gcpGreenfield", "renewalWindow", "completedAt", "version", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,NOW(),NOW())
     ON CONFLICT ("companyId") DO UPDATE SET
       "providers"=EXCLUDED."providers", "resellerStatus"=EXCLUDED."resellerStatus", "resellerWebsite"=EXCLUDED."resellerWebsite",
       "agreementStatus"=EXCLUDED."agreementStatus", "agreementStartDate"=EXCLUDED."agreementStartDate", "agreementEndDate"=EXCLUDED."agreementEndDate",
       "minimumCommitmentUsd"=EXCLUDED."minimumCommitmentUsd", "discountPct"=EXCLUDED."discountPct", "gcpGreenfield"=EXCLUDED."gcpGreenfield",
       "renewalWindow"=EXCLUDED."renewalWindow", "completedAt"=NOW(), "skippedAt"=NULL, "version"=EXCLUDED."version", "updatedAt"=NOW()
     RETURNING "id"`,
    values,
  );
  redirect("/briefs/new");
}

export async function skipCloudContextAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect("/auth/sign-in");
  await queryOne(
    `INSERT INTO "CompanyCloudContext" ("id", "companyId", "providers", "gcpGreenfield", "renewalWindow", "skippedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, '[]', true, false, NOW(), NOW(), NOW())
     ON CONFLICT ("companyId") DO UPDATE SET "skippedAt"=NOW(), "updatedAt"=NOW()
     RETURNING "id"`,
    [genId(), session.user.companyId],
  );
  redirect("/briefs/new");
}

function parseMonth(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const result = new Date(`${value}-01T00:00:00.000Z`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function numericOrNull(value: number | undefined): number | null {
  return value == null || Number.isNaN(value) ? null : value;
}

function normalizeUrl(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
