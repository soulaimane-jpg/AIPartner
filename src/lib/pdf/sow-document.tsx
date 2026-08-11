/* eslint-disable react/no-unknown-property */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

Font.registerHyphenationCallback((word) => [word]);

/**
 * Data model the PDF renderer consumes. Purposefully loose so we can
 * render partially-filled briefs cleanly.
 */
export type SowPdfData = {
  title: string;
  createdAt: string; // ISO date
  completion: number; // 0..100
  customerCompany: string;
  stage: string;
  executiveSummary?: string | null;
  scopeRequirements: { title: string; detail: string }[];
  successCriteria: { metric: string; target: string }[];
  dataSources: { name: string; detail: string }[];
  integrationPoints: { title: string; detail: string }[];
  customerRoles: string[];
  milestones: { title: string; date: string }[];
  targetGoLive?: string | null;
  budgetRange?: string | null;
  preferredLocation?: string | null;
  requiredCertifications: string[];
  industryExperience: string[];
  procurementType?: string | null;
  decisionMakers: string[];
  selectionCriteria: string[];
  services: string[];
};

/* ── Brand tokens ─────────────────────────────────────────── */
const BRAND = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  accent: "#0ea5e9",
  ink: "#0f172a",
  body: "#334155",
  mute: "#64748b",
  hairline: "#e2e8f0",
  surface: "#f8fafc",
  success: "#059669",
  warn: "#d97706",
  danger: "#dc2626",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: BRAND.body,
    lineHeight: 1.55,
  },
  pageHeader: {
    position: "absolute",
    top: 20,
    left: 48,
    right: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    color: BRAND.mute,
    fontSize: 8.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    color: BRAND.mute,
    fontSize: 8.5,
  },
  pageFooterBar: {
    position: "absolute",
    bottom: 44,
    left: 48,
    right: 48,
    height: 0.6,
    backgroundColor: BRAND.hairline,
  },
  pageNum: {
    color: BRAND.primary,
    fontFamily: "Helvetica-Bold",
  },

  /* Cover ------------------------------------------------- */
  cover: {
    flex: 1,
    margin: -48,
    marginTop: -56,
    marginBottom: -64,
  },
  coverBand: {
    backgroundColor: BRAND.ink,
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
  },
  coverBody: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: 44,
    paddingHorizontal: 56,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  coverBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  coverLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: BRAND.primary,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    textAlign: "center",
    paddingTop: 7,
    marginRight: 10,
  },
  coverBrandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#ffffff",
    letterSpacing: 2,
  },
  coverKicker: {
    color: "#94a3b8",
    fontSize: 9,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 36,
    fontFamily: "Helvetica-Bold",
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    lineHeight: 1.2,
    marginTop: 10,
  },
  coverSubtitle: {
    fontSize: 11.5,
    color: "#cbd5e1",
    marginTop: 14,
    lineHeight: 1.6,
    maxWidth: 440,
  },

  coverMetaRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  coverMetaCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRightWidth: 0.6,
    borderColor: BRAND.hairline,
  },
  coverMetaCardLast: {
    borderRightWidth: 0,
  },
  coverMetaLabel: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: BRAND.mute,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  coverMetaValue: {
    fontSize: 12.5,
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
  },
  coverMetaBox: {
    marginTop: 24,
    borderWidth: 0.8,
    borderColor: BRAND.hairline,
    borderRadius: 8,
    flexDirection: "row",
  },

  /* Completion ---------------------------------------------- */
  completionLabel: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: BRAND.mute,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  completionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  completionTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
    marginRight: 14,
  },
  completionFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: BRAND.primary,
  },
  completionVal: {
    fontSize: 11,
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
  },

  coverFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    color: BRAND.mute,
    fontSize: 8.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingTop: 16,
    borderTopWidth: 0.6,
    borderColor: BRAND.hairline,
  },

  /* Body sections ----------------------------------------- */
  sectionNumber: {
    color: BRAND.primary,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  h1: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    marginTop: 16,
    marginBottom: 6,
  },
  kicker: {
    fontSize: 10,
    color: BRAND.mute,
    marginBottom: 18,
    maxWidth: 460,
  },
  rule: {
    height: 2,
    width: 36,
    backgroundColor: BRAND.primary,
    marginTop: 6,
    marginBottom: 16,
  },

  p: {
    fontSize: 10.5,
    color: BRAND.body,
    lineHeight: 1.65,
  },

  /* Summary card ------------------------------------------ */
  summaryCard: {
    borderWidth: 1,
    borderColor: BRAND.hairline,
    borderRadius: 10,
    padding: 18,
    backgroundColor: BRAND.surface,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
  },

  /* Req cards --------------------------------------------- */
  reqGrid: {
    gap: 10,
  },
  reqCard: {
    borderWidth: 1,
    borderColor: BRAND.hairline,
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#ffffff",
  },
  reqTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  reqChip: {
    fontSize: 8,
    letterSpacing: 1.6,
    fontFamily: "Helvetica-Bold",
    color: BRAND.primary,
    backgroundColor: "#dbeafe",
    paddingTop: 3,
    paddingBottom: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    textTransform: "uppercase",
  },
  reqTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
    color: BRAND.ink,
  },
  reqDetail: {
    fontSize: 10,
    color: BRAND.body,
    marginTop: 4,
    lineHeight: 1.6,
  },

  /* KV grid (scope/integration) --------------------------- */
  kvRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  kvKey: {
    width: 120,
    color: BRAND.mute,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kvVal: {
    flex: 1,
    color: BRAND.ink,
    fontSize: 10.5,
  },

  /* Table (success criteria) ------------------------------ */
  table: {
    borderWidth: 1,
    borderColor: BRAND.hairline,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: BRAND.surface,
    borderBottomWidth: 1,
    borderColor: BRAND.hairline,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableHeadCell: {
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: BRAND.mute,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderColor: BRAND.hairline,
  },
  tableRowAlt: {
    backgroundColor: "#fbfdff",
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: BRAND.ink,
    paddingRight: 8,
  },
  tableCellStrong: {
    fontFamily: "Helvetica-Bold",
    color: BRAND.primaryDark,
  },

  /* Chips --------------------------------------------------*/
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    color: BRAND.primaryDark,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  /* Facts strip ------------------------------------------- */
  factsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  factCard: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.hairline,
    backgroundColor: "#ffffff",
  },
  factLabel: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: BRAND.mute,
    fontFamily: "Helvetica-Bold",
  },
  factValue: {
    marginTop: 6,
    fontSize: 13,
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
  },

  /* Milestone rail --------------------------------------- */
  timeline: {
    borderLeftWidth: 1,
    borderLeftColor: BRAND.hairline,
    paddingLeft: 14,
    gap: 10,
  },
  timelineItem: {
    position: "relative",
  },
  timelineDot: {
    position: "absolute",
    left: -18,
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.primary,
  },
  timelineTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
  },
  timelineDate: {
    fontSize: 9.5,
    color: BRAND.mute,
    marginTop: 2,
  },

  /* Empty state ------------------------------------------ */
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: BRAND.hairline,
    borderRadius: 8,
    padding: 14,
    color: BRAND.mute,
    fontStyle: "italic",
    fontSize: 10,
    textAlign: "center",
  },
});

/* ── Small inline helpers ─────────────────────────────── */

function SectionHeader({
  number,
  title,
  kicker,
}: {
  number: string;
  title: string;
  kicker?: string;
}) {
  return (
    <View>
      <Text style={s.sectionNumber}>Section {number}</Text>
      <Text style={s.h1}>{title}</Text>
      <View style={s.rule} />
      {kicker ? <Text style={s.kicker}>{kicker}</Text> : null}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return <Text style={s.empty}>{children}</Text>;
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <Empty>No entries captured.</Empty>;
  return (
    <View style={s.chipRow}>
      {items.map((c, i) => (
        <Text key={`${c}-${i}`} style={s.chip}>
          {c}
        </Text>
      ))}
    </View>
  );
}

/* ── The main document ────────────────────────────────── */

export function SowPdfDocument({ data }: { data: SowPdfData }): ReactElement {
  const dateLabel = new Date(data.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const runningHeader = (
    <View style={s.pageHeader} fixed>
      <Text>AI Partner · Statement of Work</Text>
      <Text>{data.title.slice(0, 70)}</Text>
    </View>
  );
  const runningFooter = (
    <>
      <View style={s.pageFooterBar} fixed />
      <View style={s.pageFooter} fixed>
        <Text>Confidential · Prepared for {data.customerCompany}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          style={s.pageNum}
        />
      </View>
    </>
  );

  return (
    <Document
      title={data.title}
      author="AI Partner"
      subject="Statement of Work"
      creator="AI Partner Platform"
    >
      {/* ---- Cover ---- */}
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          {/* Top navy band */}
          <View style={s.coverBand}>
            <View style={s.coverBrand}>
              <Text style={s.coverLogo}>A</Text>
              <Text style={s.coverBrandLabel}>AI PARTNER</Text>
            </View>
            <Text style={s.coverKicker}>Statement of Work</Text>
            <Text style={s.coverTitle}>{data.title}</Text>
            {data.executiveSummary ? (
              <Text style={s.coverSubtitle}>
                {data.executiveSummary.split(/\n+/)[0].slice(0, 240)}
              </Text>
            ) : null}
          </View>

          {/* White body */}
          <View style={s.coverBody}>
            <View>
              <View style={s.coverMetaBox}>
                <View style={s.coverMetaCard}>
                  <Text style={s.coverMetaLabel}>Prepared for</Text>
                  <Text style={s.coverMetaValue}>{data.customerCompany}</Text>
                </View>
                <View style={s.coverMetaCard}>
                  <Text style={s.coverMetaLabel}>Date</Text>
                  <Text style={s.coverMetaValue}>{dateLabel}</Text>
                </View>
                <View style={[s.coverMetaCard, s.coverMetaCardLast]}>
                  <Text style={s.coverMetaLabel}>Stage</Text>
                  <Text style={s.coverMetaValue}>{data.stage}</Text>
                </View>
              </View>

              <View style={{ marginTop: 28 }}>
                <Text style={s.completionLabel}>Brief completion</Text>
                <View style={s.completionRow}>
                  <View style={s.completionTrack}>
                    <View
                      style={[
                        s.completionFill,
                        {
                          width: `${Math.max(3, Math.min(100, data.completion))}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.completionVal}>{data.completion}%</Text>
                </View>
              </View>
            </View>

            <View style={s.coverFooter}>
              <Text>AI Partner Platform</Text>
              <Text>Confidential</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ---- 1 · Executive Summary ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <SectionHeader
          number="01"
          title="Executive Summary"
          kicker="What we're solving, for whom, and the desired outcome."
        />
        {data.executiveSummary ? (
          <View style={s.summaryCard}>
            <Text style={s.p}>{data.executiveSummary}</Text>
          </View>
        ) : (
          <Empty>The executive summary has not been captured yet.</Empty>
        )}

        <Text style={s.h2}>Services required</Text>
        <Chips items={data.services} />

        {data.industryExperience.length > 0 ? (
          <>
            <Text style={s.h2}>Industry context</Text>
            <Chips items={data.industryExperience} />
          </>
        ) : null}

        {runningFooter}
      </Page>

      {/* ---- 2 · Scope & Requirements ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <SectionHeader
          number="02"
          title="Scope & Requirements"
          kicker="Concrete deliverables and capabilities the partner is asked to build."
        />
        {data.scopeRequirements.length === 0 ? (
          <Empty>No requirements captured yet.</Empty>
        ) : (
          <View style={s.reqGrid}>
            {data.scopeRequirements.map((r, i) => (
              <View key={i} style={s.reqCard} wrap={false}>
                <View style={s.reqTag}>
                  <Text style={s.reqChip}>
                    REQ-{String(i + 1).padStart(2, "0")}
                  </Text>
                </View>
                <Text style={s.reqTitle}>{r.title}</Text>
                {r.detail ? <Text style={s.reqDetail}>{r.detail}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {data.dataSources.length > 0 ? (
          <>
            <Text style={s.h2}>Data sources</Text>
            {data.dataSources.map((d, i) => (
              <View key={i} style={s.kvRow} wrap={false}>
                <Text style={s.kvKey}>{d.name}</Text>
                <Text style={s.kvVal}>{d.detail}</Text>
              </View>
            ))}
          </>
        ) : null}

        {data.integrationPoints.length > 0 ? (
          <>
            <Text style={s.h2}>Integration points</Text>
            {data.integrationPoints.map((it, i) => (
              <View key={i} style={s.kvRow} wrap={false}>
                <Text style={s.kvKey}>{it.title}</Text>
                <Text style={s.kvVal}>{it.detail}</Text>
              </View>
            ))}
          </>
        ) : null}

        {runningFooter}
      </Page>

      {/* ---- 3 · Success criteria ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <SectionHeader
          number="03"
          title="Success Criteria"
          kicker="Measurable outcomes the engagement will be evaluated against."
        />
        {data.successCriteria.length === 0 ? (
          <Empty>No KPIs defined yet.</Empty>
        ) : (
          <View style={s.table}>
            <View style={s.tableHead} fixed>
              <Text style={s.tableHeadCell}>Metric</Text>
              <Text style={s.tableHeadCell}>Target</Text>
            </View>
            {data.successCriteria.map((row, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow}
                wrap={false}
              >
                <Text style={[s.tableCell, s.tableCellStrong]}>
                  {row.metric}
                </Text>
                <Text style={s.tableCell}>{row.target}</Text>
              </View>
            ))}
          </View>
        )}
        {runningFooter}
      </Page>

      {/* ---- 4 · Timing, Budget, Constraints ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <SectionHeader
          number="04"
          title="Timing · Budget · Constraints"
          kicker="The operating envelope for this engagement."
        />

        <View style={s.factsRow}>
          <View style={s.factCard}>
            <Text style={s.factLabel}>Target go-live</Text>
            <Text style={s.factValue}>{data.targetGoLive || "TBD"}</Text>
          </View>
          <View style={s.factCard}>
            <Text style={s.factLabel}>Budget range</Text>
            <Text style={[s.factValue, { color: BRAND.success }]}>
              {data.budgetRange || "TBD"}
            </Text>
          </View>
          <View style={s.factCard}>
            <Text style={s.factLabel}>Preferred region</Text>
            <Text style={s.factValue}>{data.preferredLocation || "TBD"}</Text>
          </View>
        </View>

        {data.milestones.length > 0 ? (
          <>
            <Text style={s.h2}>Key milestones</Text>
            <View style={s.timeline}>
              {data.milestones.map((m, i) => (
                <View key={i} style={s.timelineItem} wrap={false}>
                  <View style={s.timelineDot} />
                  <Text style={s.timelineTitle}>{m.title}</Text>
                  {m.date ? (
                    <Text style={s.timelineDate}>{m.date}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.h2}>Compliance & certifications</Text>
        <Chips items={data.requiredCertifications} />

        {runningFooter}
      </Page>

      {/* ---- 5 · Stakeholders & Selection ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <SectionHeader
          number="05"
          title="Stakeholders & Selection"
          kicker="Who is involved and how the partner will be chosen."
        />

        <Text style={s.h2}>Users / roles served</Text>
        <Chips items={data.customerRoles} />

        <Text style={s.h2}>Decision makers</Text>
        <Chips items={data.decisionMakers} />

        <Text style={s.h2}>Partner selection criteria</Text>
        {data.selectionCriteria.length === 0 ? (
          <Empty>Selection criteria not yet defined.</Empty>
        ) : (
          <View style={{ marginTop: 4 }}>
            {data.selectionCriteria.map((c, i) => (
              <View
                key={i}
                style={{ flexDirection: "row", marginBottom: 4, gap: 8 }}
                wrap={false}
              >
                <Text
                  style={{
                    color: BRAND.primary,
                    fontFamily: "Helvetica-Bold",
                  }}
                >
                  ●
                </Text>
                <Text style={[s.p, { flex: 1 }]}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>Procurement</Text>
        <Text style={s.p}>
          {procurementLabel(data.procurementType)}
        </Text>

        {runningFooter}
      </Page>

      {/* ---- Closing ---- */}
      <Page size="A4" style={s.page}>
        {runningHeader}
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 3,
              color: BRAND.mute,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Next step
          </Text>
          <Text
            style={{
              fontSize: 22,
              color: BRAND.ink,
              fontFamily: "Helvetica-Bold",
              maxWidth: 460,
              lineHeight: 1.3,
            }}
          >
            Share this SoW with a curated shortlist of Google Cloud partners
            and invite tailored proposals.
          </Text>
          <Text
            style={{
              marginTop: 20,
              color: BRAND.mute,
              maxWidth: 460,
              lineHeight: 1.7,
              fontSize: 10.5,
            }}
          >
            AI Partner matches this brief against our partner network using
            the captured specializations, industry experience, and delivery
            regions. You will approve each proposed partner before they see the
            full document.
          </Text>

          <View
            style={{
              marginTop: 36,
              borderTopWidth: 0.6,
              borderColor: BRAND.hairline,
              paddingTop: 16,
              width: "100%",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: BRAND.mute, fontSize: 9 }}>
              Generated {dateLabel}
            </Text>
            <Text style={{ color: BRAND.mute, fontSize: 9 }}>
              AI Partner Platform
            </Text>
          </View>
        </View>
        {runningFooter}
      </Page>
    </Document>
  );
}

function procurementLabel(code?: string | null): string {
  switch (code) {
    case "DIRECT_GOOGLE":
      return "Direct Google Cloud procurement — contract through Google.";
    case "VIA_RESELLER":
      return "Via a Google Cloud reseller / partner of record.";
    case "UNSURE":
      return "Customer is still evaluating the procurement path.";
    default:
      return "Procurement path not yet determined.";
  }
}
