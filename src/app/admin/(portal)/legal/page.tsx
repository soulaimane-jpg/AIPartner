import { count } from "@/lib/db";
import {
  LEGAL_DOC_TYPES,
  getCurrentDocument,
  type LegalDocType,
} from "@/lib/legal/documents";
import { PublishLegalForm } from "./publish-legal-form";
import { requireAdmin } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legal documents · Admin" };

const DOC_TYPE_LABELS: Record<LegalDocType, string> = {
  company_terms: "Company — Terms & Conditions",
  company_nda: "Company — NDA",
  partner_terms: "Partner — Terms & Conditions",
  partner_nda: "Partner — NDA",
  three_party_nda: "Three-party NDA (post-selection)",
};

/**
 * M1.2 — admin console for versioned legal documents. Publishing a
 * new version re-triggers the acceptance gate for every affected
 * user on next navigation.
 */
export default async function AdminLegalPage() {
  // Defence-in-depth: middleware and the portal layout also gate
  // this, but authorization should not depend on routing config alone.
  await requireAdmin();

  const docs = await Promise.all(
    LEGAL_DOC_TYPES.map(async (docType) => {
      const doc = await getCurrentDocument(docType);
      const acceptances = await count(
        'SELECT COUNT(*) FROM "LegalAcceptance" WHERE "documentId" = $1',
        [doc.id],
      );
      return { docType, doc, acceptances };
    }),
  );

  return (
    <div className="page-container-wide portal-page py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header block">
        <h1 className="portal-page-title">
          Legal documents
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground max-w-2xl">
          Current published versions. Publishing a new version archives the
          old one and re-triggers the acceptance gate for every affected user
          on their next visit. Placeholder text ships until counsel delivers
          final wording.
        </p>
      </header>

      <div className="space-y-6">
        {docs.map(({ docType, doc, acceptances }) => (
          <section
            key={docType}
            className="customer-panel overflow-hidden"
          >
            <header className="px-5 py-3 border-b border-border flex items-center gap-3">
              <h2 className="text-[14px] font-semibold text-foreground">
                {DOC_TYPE_LABELS[docType]}
              </h2>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                v{doc.version}
              </span>
              {doc.body.startsWith("PLACEHOLDER") && (
                <span className="text-[10.5px] uppercase tracking-wider rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">
                  Placeholder
                </span>
              )}
              <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
                {acceptances} acceptance{acceptances === 1 ? "" : "s"}
              </span>
            </header>
            <PublishLegalForm
              docType={docType}
              currentTitle={doc.title}
              currentBody={doc.body}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
