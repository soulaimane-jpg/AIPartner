/**
 * Versioned legal documents service — plan-A M1.
 *
 * - Documents are versioned per audience (`docType`); publishing a
 *   new version re-triggers the acceptance gate on next login.
 * - Content is PLACEHOLDER until the lawyer delivers — admins replace
 *   text and publish from the console with zero code changes.
 * - Every acceptance is recorded per (document version × user) with
 *   name/IP/UA where collected, and audit-logged by the action layer.
 */

import "server-only";
import { queryOne, insertRow, tx } from "@/lib/db";
import type { LegalDocumentRow } from "@/lib/db/rows";
import type { UserRole } from "@/lib/enums";

export const LEGAL_DOC_TYPES = [
  "company_terms",
  "company_nda",
  "partner_terms",
  "partner_nda",
  "three_party_nda",
] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

/** Doc set each audience must accept before using the platform (M1.4). */
export const REQUIRED_DOCS_BY_ROLE: Partial<Record<UserRole, LegalDocType[]>> = {
  CUSTOMER: ["company_terms", "company_nda"],
  COLLABORATOR: ["company_terms", "company_nda"],
  PARTNER: ["partner_terms", "partner_nda"],
  // ADMIN / GOOGLER are internal or referral-only — no gate.
};

const PLACEHOLDER_BODIES: Record<LegalDocType, { title: string; body: string }> = {
  company_terms: {
    title: "AIPartner — Terms & Conditions (Companies)",
    body: "PLACEHOLDER — pending final text from counsel.\n\nThese Terms & Conditions govern your use of the AIPartner platform as a customer company. By accepting, you agree to engage matched partners through the platform process, provide accurate project information, and respect the anonymized nature of partner proposals until the reveal step.\n\n[Final legal text will replace this placeholder without any change to the acceptance mechanism.]",
  },
  company_nda: {
    title: "AIPartner — Mutual NDA (Companies)",
    body: "PLACEHOLDER — pending final text from counsel.\n\nThis mutual non-disclosure agreement covers information you share in project briefs and information you receive in anonymized partner proposals.\n\n[Final legal text will replace this placeholder without any change to the acceptance mechanism.]",
  },
  partner_terms: {
    title: "AIPartner — Partner Terms & Conditions",
    body: "PLACEHOLDER — pending final text from counsel.\n\nThese terms govern your participation as a delivery partner: lead handling, response deadlines, the platform fee on won engagements, deal-reporting obligations, and the prohibition on off-platform contact before the reveal step.\n\n[Final legal text will replace this placeholder without any change to the acceptance mechanism.]",
  },
  partner_nda: {
    title: "AIPartner — Partner NDA",
    body: "PLACEHOLDER — pending final text from counsel.\n\nThis NDA covers the anonymized customer information you receive in lead invitations and briefs.\n\n[Final legal text will replace this placeholder without any change to the acceptance mechanism.]",
  },
  three_party_nda: {
    title: "AIPartner — Three-Party Mutual NDA",
    body: "PLACEHOLDER — pending final text from counsel.\n\nThis three-party NDA (customer × partner × AIPartner) is signed after intro meetings so all parties can share identified information.\n\n[Final legal text will replace this placeholder without any change to the acceptance mechanism.]",
  },
};

/**
 * Current published version of a doc type. Lazily seeds v1 with
 * placeholder content so the gate works before the lawyer delivers.
 */
export async function getCurrentDocument(docType: LegalDocType) {
  const currentSql = `SELECT * FROM "LegalDocument"
     WHERE "docType" = $1 AND "status" = 'published'
     ORDER BY "version" DESC LIMIT 1`;
  const existing = await queryOne<LegalDocumentRow>(currentSql, [docType]);
  if (existing) return existing;

  const placeholder = PLACEHOLDER_BODIES[docType];
  return insertRow<LegalDocumentRow>("LegalDocument", {
    docType,
    version: 1,
    title: placeholder.title,
    body: placeholder.body,
    status: "published",
    publishedAt: new Date(),
  }).catch(async () => {
    // Unique race — someone else seeded; re-read.
    const doc = await queryOne<LegalDocumentRow>(currentSql, [docType]);
    if (!doc) throw new Error(`Failed to seed legal document ${docType}`);
    return doc;
  });
}

/** Doc types (current versions) the user still has to accept. */
export async function getPendingLegalDocs(
  userId: string,
  role: UserRole,
): Promise<Array<{ id: string; docType: string; version: number; title: string; body: string }>> {
  const required = REQUIRED_DOCS_BY_ROLE[role];
  if (!required || required.length === 0) return [];

  const pending: Array<{
    id: string;
    docType: string;
    version: number;
    title: string;
    body: string;
  }> = [];
  for (const docType of required) {
    const doc = await getCurrentDocument(docType);
    const accepted = await queryOne(
      'SELECT 1 AS ok FROM "LegalAcceptance" WHERE "documentId" = $1 AND "userId" = $2',
      [doc.id, userId],
    );
    if (!accepted) {
      pending.push({
        id: doc.id,
        docType: doc.docType,
        version: doc.version,
        title: doc.title,
        body: doc.body,
      });
    }
  }
  return pending;
}

/** True when the user has accepted every current required document. */
export async function hasAcceptedCurrentLegal(
  userId: string,
  role: UserRole,
): Promise<boolean> {
  const pending = await getPendingLegalDocs(userId, role);
  return pending.length === 0;
}

/** Record one acceptance (idempotent per document × user). */
export async function recordAcceptance(opts: {
  documentId: string;
  userId: string;
  companyId?: string | null;
  acceptedName?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  // Append-only semantics: first acceptance wins.
  await insertRow(
    "LegalAcceptance",
    {
      documentId: opts.documentId,
      userId: opts.userId,
      companyId: opts.companyId ?? null,
      acceptedName: opts.acceptedName ?? null,
      ipHash: opts.ipHash ?? null,
      userAgent: opts.userAgent ?? null,
    },
    { noUpdatedAt: true, onConflict: '("documentId", "userId") DO NOTHING' },
  );
}

/**
 * Publish a new version of a document (admin console). The next
 * login of every affected user re-triggers the gate (M1.2).
 */
export async function publishNewVersion(opts: {
  docType: LegalDocType;
  title: string;
  body: string;
  publishedBy: string;
}) {
  const latest = await queryOne<{ version: number }>(
    'SELECT "version" FROM "LegalDocument" WHERE "docType" = $1 ORDER BY "version" DESC LIMIT 1',
    [opts.docType],
  );
  const nextVersion = (latest?.version ?? 0) + 1;

  return tx(async (client) => {
    await client.query(
      `UPDATE "LegalDocument" SET "status" = 'archived', "updatedAt" = NOW()
       WHERE "docType" = $1 AND "status" = 'published'`,
      [opts.docType],
    );
    return insertRow<LegalDocumentRow>(
      "LegalDocument",
      {
        docType: opts.docType,
        version: nextVersion,
        title: opts.title,
        body: opts.body,
        status: "published",
        publishedAt: new Date(),
        publishedBy: opts.publishedBy,
      },
      { client },
    );
  });
}
