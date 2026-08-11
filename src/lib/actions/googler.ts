"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { queryOne, insertRow } from "@/lib/db";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/provider";

/**
 * Admin creates a Googler account with a generated temporary password.
 * The admin must pass the returned password to the Google Sales Rep manually.
 */
const createGooglerSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
});

export type CreateGooglerResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; error: string };

export async function createGooglerAccountAction(
  _prev: CreateGooglerResult | undefined,
  formData: FormData,
): Promise<CreateGooglerResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only admins can provision Googler accounts" };
  }

  const parsed = createGooglerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    jobTitle: formData.get("jobTitle") || undefined,
    location: formData.get("location") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const normalized = parsed.data.email.trim().toLowerCase();
  const existing = await queryOne<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "email" = $1',
    [normalized],
  );
  if (existing) return { ok: false, error: "An account with this email already exists" };

  // Generate a memorable-ish temp password: 3 words + 2 digits.
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 10);

  await insertRow("User", {
    email: normalized,
    name: parsed.data.name,
    passwordHash: hash,
    role: "GOOGLER",
    jobTitle: parsed.data.jobTitle ?? "Google Sales Representative",
    location: parsed.data.location ?? null,
  });

  revalidatePath("/admin/googlers");
  return { ok: true, email: normalized, tempPassword };
}

/**
 * A Googler submits a new lead (customer email + domain).
 * Generates an invite token, stores a mock email body, and records the lead.
 */
const submitLeadSchema = z.object({
  customerEmail: z.string().email("A valid work email is required"),
  customerDomain: z.string().min(3, "Enter the customer's company domain"),
  customerName: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

export type SubmitLeadResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

export async function submitLeadAction(
  _prev: SubmitLeadResult | undefined,
  formData: FormData,
): Promise<SubmitLeadResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "GOOGLER") {
    return { ok: false, error: "Only signed-in Googlers can submit leads" };
  }

  const parsed = submitLeadSchema.safeParse({
    customerEmail: formData.get("customerEmail"),
    customerDomain: formData.get("customerDomain"),
    customerName: formData.get("customerName") || undefined,
    companyName: formData.get("companyName") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const customerEmail = parsed.data.customerEmail.trim().toLowerCase();
  const customerDomain = parsed.data.customerDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*/, "");

  // Prevent duplicate active invites for the same email.
  const existing = await queryOne<{ id: string }>(
    `SELECT "id" FROM "Lead"
     WHERE "customerEmail" = $1 AND "status" IN ('INVITED', 'CLAIMED')
     LIMIT 1`,
    [customerEmail],
  );
  if (existing) {
    return { ok: false, error: "An active lead already exists for this customer email" };
  }

  const inviteToken = randomBytes(24).toString("base64url");
  const googler = await queryOne<{ name: string | null }>(
    'SELECT "name" FROM "User" WHERE "id" = $1',
    [session.user.id],
  );

  const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/auth/sign-up?invite=${inviteToken}&email=${encodeURIComponent(customerEmail)}`;
  const { subject, body } = buildInviteEmail({
    customerName: parsed.data.customerName,
    companyName: parsed.data.companyName,
    googlerName: googler?.name ?? "Your Google representative",
    inviteUrl: inviteUrl || `/auth/sign-up?invite=${inviteToken}`,
  });
  const mockEmailBody = `Subject: ${subject}\n\n${body}`;

  const lead = await insertRow<{ id: string }>("Lead", {
    googlerId: session.user.id,
    customerEmail,
    customerDomain,
    customerName: parsed.data.customerName ?? null,
    companyName: parsed.data.companyName ?? null,
    notes: parsed.data.notes ?? null,
    inviteToken,
    mockEmailBody,
    status: "INVITED",
  });

  // Deliver via the shared provider seam. Lead is already persisted, so a
  // delivery failure won't lose it.
  try {
    await sendEmail({ toAddress: customerEmail, subject, body, kind: "lead-invite" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lead-invite] email send failed:", err);
  }

  revalidatePath("/google");
  revalidatePath("/google/leads");
  return { ok: true, leadId: lead.id };
}

/**
 * Generates a temporary password that is presentable to the admin.
 * Not cryptographically chosen — but random enough for a demo bootstrap password.
 */
function generateTempPassword(): string {
  const words = ["orbit", "nimbus", "delta", "vector", "helix", "pulse", "flux", "quartz"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(10 + Math.random() * 90);
  return `${pick()}-${pick()}-${digits}`;
}

function buildInviteEmail({
  customerName,
  companyName,
  googlerName,
  inviteUrl,
}: {
  customerName?: string;
  companyName?: string;
  googlerName: string;
  inviteUrl: string;
}): { subject: string; body: string } {
  const hi = customerName ? `Hi ${customerName.split(" ")[0]},` : "Hi there,";
  const co = companyName ? ` at ${companyName}` : "";
  const subject = `A faster way to find the right Google Cloud partner${co}`;
  const body = [
    `${hi}`,
    ``,
    `${googlerName} from Google Cloud thought AI Partner would be useful for your team.`,
    ``,
    `AI Partner is an AI-assisted platform that turns your project goals into a clean Statement of Work, matches you with vetted GCP engineering partners, and gives you visibility across proposals — all in a few hours, not weeks.`,
    ``,
    `Why it works:`,
    ` • Shortlist in 48h — ranked partners, not a directory`,
    ` • Vetted delivery — every partner is reviewed by Google`,
    ` • Unbiased — rankings are based on your brief, not who paid most`,
    ` • Full visibility — proposal status, meetings, and selection in one place`,
    ``,
    `Claim your invite:`,
    `${inviteUrl}`,
    ``,
    `— The AI Partner team`,
  ].join("\n");
  return { subject, body };
}
