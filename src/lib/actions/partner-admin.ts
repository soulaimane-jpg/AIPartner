"use server";

/**
 * M5 — partner database admin operations (plan-A).
 *
 * - Manual partner entry (scraped import already exists) with `source`
 *   tracking: imported | manual | self_registered.
 * - Multiple contact persons per partner; the primary contact is the
 *   lead-routing recipient for invite notifications (M5.2).
 * - T&C tracking: not_sent | sent | accepted | declined (M5.3) —
 *   `accepted` is written by the legal gate, the rest by admins.
 * - Preference-question config (M3.4): which partner-preference
 *   questions companies see during brief intake, admin-editable.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, fail } from "@/lib/actions/define";
import { queryOne, exec, insertRow, updateRows, tx } from "@/lib/db";

// ─── Manual partner creation ──────────────────────────────────

const CreatePartnerInput = z.object({
  name: z.string().min(2).max(200),
  website: z.string().url().optional().or(z.literal("")),
  headquarters: z.string().max(200).optional(),
  sizeBand: z.string().max(50).optional(),
  clouds: z.array(z.enum(["gcp", "aws", "azure"])).default(["gcp"]),
});

export const adminCreatePartnerAction = defineAction({
  name: "admin.partner.create",
  input: CreatePartnerInput,
  output: z.object({ companyId: z.string() }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.create", limit: 20, windowSec: 60 },
  handler: async (data) => {
    const company = await tx(async (client) => {
      const c = await insertRow<{ id: string }>(
        "Company",
        {
          name: data.name,
          kind: "PARTNER",
          website: data.website || null,
        },
        { client },
      );
      await insertRow(
        "PartnerProfile",
        {
          companyId: c.id,
          headquarters: data.headquarters ?? null,
          website: data.website || null,
          sizeBand: data.sizeBand ?? null,
          clouds: JSON.stringify(data.clouds),
          source: "manual",
          tncStatus: "not_sent",
        },
        { client },
      );
      return c;
    });
    revalidatePath("/admin/partners");
    return { companyId: company.id };
  },
});

// ─── T&C status tracking ──────────────────────────────────────

const TncStatusInput = z.object({
  companyId: z.string().min(1),
  tncStatus: z.enum(["not_sent", "sent", "accepted", "declined"]),
});

export const adminSetPartnerTncStatusAction = defineAction({
  name: "admin.partner.tnc-status",
  input: TncStatusInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.tnc", limit: 60, windowSec: 60 },
  handler: async ({ companyId, tncStatus }) => {
    const profile = await queryOne<{ id: string }>(
      'SELECT "id" FROM "PartnerProfile" WHERE "companyId" = $1',
      [companyId],
    );
    if (!profile) fail({ code: "NOT_FOUND", resource: "PartnerProfile" });
    await updateRows("PartnerProfile", { companyId }, { tncStatus });
    revalidatePath(`/admin/partners/${companyId}`);
    revalidatePath("/admin/partners");
    return { ok: true as const };
  },
});

// ─── Contact persons (lead routing) ───────────────────────────

const UpsertContactInput = z.object({
  companyId: z.string().min(1),
  contactId: z.string().optional(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  email: z.string().email(),
  isPrimary: z.boolean().default(false),
});

export const adminUpsertPartnerContactAction = defineAction({
  name: "admin.partner.contact.upsert",
  input: UpsertContactInput,
  output: z.object({ contactId: z.string() }),
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.contact", limit: 60, windowSec: 60 },
  handler: async ({ companyId, contactId, name, role, email, isPrimary }) => {
    const profile = await queryOne<{ id: string }>(
      'SELECT "id" FROM "PartnerProfile" WHERE "companyId" = $1',
      [companyId],
    );
    if (!profile) fail({ code: "NOT_FOUND", resource: "PartnerProfile" });

    // Only one primary (lead-routing) contact per partner.
    if (isPrimary) {
      await exec(
        `UPDATE "PartnerContact" SET "isPrimary" = FALSE, "updatedAt" = NOW()
         WHERE "profileId" = $1 AND "isPrimary" = TRUE`,
        [profile!.id],
      );
    }

    const contact = contactId
      ? (
          await updateRows<{ id: string }>(
            "PartnerContact",
            { id: contactId },
            { name, role: role ?? null, email, isPrimary },
          )
        )[0]
      : await insertRow<{ id: string }>("PartnerContact", {
          profileId: profile!.id,
          name,
          role: role ?? null,
          email,
          isPrimary,
        });

    revalidatePath(`/admin/partners/${companyId}`);
    return { contactId: contact.id };
  },
});

const DeleteContactInput = z.object({
  companyId: z.string().min(1),
  contactId: z.string().min(1),
});

export const adminDeletePartnerContactAction = defineAction({
  name: "admin.partner.contact.delete",
  input: DeleteContactInput,
  permission: "admin.partner-ops",
  rateLimit: { scope: "admin.partner.contact", limit: 60, windowSec: 60 },
  handler: async ({ companyId, contactId }) => {
    await exec('DELETE FROM "PartnerContact" WHERE "id" = $1', [contactId]);
    revalidatePath(`/admin/partners/${companyId}`);
    return { ok: true as const };
  },
});

// ─── Preference-question config (M3.4) ────────────────────────

const PREFERENCE_FIELD_KEYS = [
  "regions",
  "languages",
  "clouds",
  "specializations",
  "sizeBand",
  "tier",
  "serviceModels",
] as const;

const PreferenceQuestionInput = z.object({
  fieldKey: z.enum(PREFERENCE_FIELD_KEYS),
  label: z.string().min(3).max(500),
  enabled: z.boolean(),
  rank: z.coerce.number().int().min(0).max(1000).default(100),
});

export const adminSetPreferenceQuestionAction = defineAction({
  name: "admin.preference-question.set",
  input: PreferenceQuestionInput,
  permission: "admin.settings.configure",
  rateLimit: { scope: "admin.pref-question", limit: 60, windowSec: 60 },
  handler: async ({ fieldKey, label, enabled, rank }) => {
    await insertRow(
      "PreferenceQuestion",
      { fieldKey, label, enabled, rank },
      {
        onConflict: `("fieldKey") DO UPDATE SET
          "label" = EXCLUDED."label",
          "enabled" = EXCLUDED."enabled",
          "rank" = EXCLUDED."rank",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );
    revalidatePath("/admin/settings");
    return { ok: true as const };
  },
});
