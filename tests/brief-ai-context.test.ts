import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRIEF_EXTRACTION_CONTRACT, buildBriefSystemPrompt } from "@/lib/brief-prompts";
import { computeCompletionBreakdown } from "@/lib/brief";
import type { ProjectBriefRow } from "@/lib/db/rows";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const chatRoute = read("src/app/api/chat/route.ts");
const createAction = read("src/lib/actions/briefs.ts");

/** Every brief field the completion breakdown scores, by signal. */
const SCORED_FIELDS = [
  "executiveSummary",
  "successCriteria",
  "scopeRequirements",
  "dataSources",
  "integrationPoints",
  "services",
  "targetGoLive",
  "milestones",
  "budgetRange",
  "preferredLocation",
  "requiredCertifications",
  "industryExperience",
  "customerRoles",
  "decisionMakers",
  "selectionCriteria",
  "procurementType",
] as const;

function briefRow(overrides: Partial<ProjectBriefRow> = {}): ProjectBriefRow {
  return {
    services: JSON.stringify(["CONSULTING"]),
    deliveryModel: "[]",
    intentRoute: "TECHNICAL",
    cloudContextSnapshot: "{}",
    targetGoLive: null,
    budgetRange: null,
    ...overrides,
  } as ProjectBriefRow;
}

describe("AI builder context", () => {
  it("passes every creation-time customer answer into the chat prompt", () => {
    for (const key of [
      "services",
      "deliveryModel",
      "procurement",
      "usesCloudToday",
      "hasWorkedWithPartnerBefore",
      "cloudContextSnapshot",
      "title",
    ]) {
      expect(chatRoute).toContain(`${key}:`);
    }
  });

  it("carries a definite procurement answer into the scored SoW field", () => {
    expect(createAction).toContain("procurementType:");
    expect(createAction).toContain('parsed.procurement !== "UNSURE"');
  });

  it("keeps commercial terms out of technical briefs", () => {
    expect(chatRoute).toContain("briefCloudContext");
    expect(chatRoute).toContain('brief.intentRoute === "COMMERCIAL"');
  });

  it("makes every scored SoW field extractable from the conversation", () => {
    for (const field of SCORED_FIELDS) {
      expect(BRIEF_EXTRACTION_CONTRACT).toContain(field);
    }
  });

  it("persists every scored SoW field returned by the model", () => {
    for (const field of SCORED_FIELDS) {
      expect(chatRoute).toContain(`"${field}"`);
    }
  });

  it("reaches 100% completion from chat-extractable fields alone", () => {
    const { total } = computeCompletionBreakdown({
      executiveSummary: "Problem and outcome.",
      successCriteria: JSON.stringify([{ metric: "latency", target: "<1s" }]),
      scopeRequirements: JSON.stringify([{ title: "Migrate", detail: "x" }]),
      dataSources: JSON.stringify([{ name: "Postgres", detail: "x" }]),
      integrationPoints: JSON.stringify([{ title: "SAP", detail: "x" }]),
      services: JSON.stringify(["Data Analytics"]),
      targetGoLive: "Q2 2026",
      milestones: JSON.stringify([{ title: "Kickoff", date: "2026-03" }]),
      budgetRange: "$150k-$250k",
      preferredLocation: "EMEA",
      requiredCertifications: JSON.stringify(["ISO 27001"]),
      industryExperience: JSON.stringify(["Retail"]),
      customerRoles: JSON.stringify(["Analysts"]),
      decisionMakers: JSON.stringify(["CTO"]),
      selectionCriteria: JSON.stringify(["EMEA delivery team"]),
      procurementType: "VIA_RESELLER",
    });
    expect(total).toBe(100);
  });

  it("tailors the system prompt to the selected engagement types", () => {
    const managed = buildBriefSystemPrompt(
      briefRow({ services: JSON.stringify(["MANAGED"]) }),
    );
    expect(managed).toContain("Managed Services (Ongoing Ops)");
    expect(managed).toContain("SLAs/SLOs");

    const commercial = buildBriefSystemPrompt(
      briefRow({
        services: JSON.stringify(["RESELLING"]),
        intentRoute: "COMMERCIAL",
      }),
    );
    expect(commercial).toContain("commercial AI Partner brief builder");
  });

  it("always demands the structured extraction blocks", () => {
    const prompt = buildBriefSystemPrompt(briefRow());
    expect(prompt).toContain("<brief_update>");
    expect(prompt).toContain("<answer_rating>");
  });
});
