import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const homepage = readFileSync(resolve(root, "src/app/(marketing)/page.tsx"), "utf8");
const header = readFileSync(
  resolve(root, "src/components/marketing/marketing-header.tsx"),
  "utf8",
);
const footer = readFileSync(
  resolve(root, "src/components/marketing/marketing-footer.tsx"),
  "utf8",
);
const timeline = readFileSync(
  resolve(root, "src/components/marketing/process-timeline.tsx"),
  "utf8",
);
const visuals = readFileSync(
  resolve(root, "src/components/marketing/premium-home-visuals.tsx"),
  "utf8",
);

describe("marketing homepage", () => {
  it("contains the approved seven-section customer journey", () => {
    for (const heading of [
      "Build, Migrate, and Scale Strategically and Cost-Efficiently on Google Cloud.",
      "Built by Google Cloud and Partner Insiders",
      "Why Work with a GCP Partner vs. Google Directly?",
      "How Partners Add Value to Your Cloud Journey",
      "Our Process: How We Find Your Match",
      "Enterprise-Grade Confidentiality",
      "Stop Guessing. Start Scaling.",
    ]) {
      expect(homepage).toContain(heading);
    }
  });

  it("pins the customer CTA and free-service disclosures", () => {
    expect(homepage).toContain('href="/auth/sign-up"');
    expect(homepage).toContain("Find Your Partner");
    expect(homepage).toContain("Get Started Now");
    expect(homepage).toContain("100% free for GCP customers");
    expect(homepage).toContain("100% free for your organization");
    expect(homepage).toContain("We are compensated entirely by the partner network");
  });

  it("removes legacy claims and synthetic social proof", () => {
    for (const banned of [
      "Watch demo",
      "Matched in 48 hours",
      "forty-eight hours",
      "ATLASBANK",
      "NORTHWIND",
      "VOYAGE",
      "PRIME TELCO",
      "SOC-2-style audit trail",
    ]) {
      expect(homepage).not.toContain(banned);
    }
  });

  it("uses premium visual structure without changing the content contract", () => {
    for (const className of [
      "home-premium",
      "home-product-stage",
      "home-capability-rail",
      "home-process-bg",
      "home-privacy",
      "home-final-cta",
    ]) {
      expect(`${homepage}${visuals}`).toContain(className);
    }
    expect(timeline).toContain("<ol");
    expect(timeline).toContain("<m.li");
    expect(homepage.match(/Find Your Partner/g)?.length).toBe(1);
    expect(homepage).toContain("<ProcessTimeline steps={PROCESS_STEPS}");
  });

  it("does not introduce unverified certification or ecosystem claims", () => {
    const designSources = `${homepage}${visuals}`;
    for (const claim of [
      "Google Cloud certified",
      "Vertex AI",
      "Gemini",
      "GDPR certified",
      "ISO certified",
      "SOC certified",
    ]) {
      expect(designSources).not.toContain(claim);
    }
  });

  it("keeps shared navigation on valid anchors and real routes", () => {
    for (const destination of [
      "/#benefits",
      "/#capabilities",
      "/#process",
      "/#privacy",
      "/pricing",
      "/partner/register",
    ]) {
      expect(header).toContain(destination);
    }

    for (const destination of [
      "/#process",
      "/#capabilities",
      "/pricing",
      "/partner/register",
      "/#privacy",
      "/trust",
    ]) {
      expect(footer).toContain(destination);
    }

    for (const brokenAnchor of ["/#how", "/#solutions", "/#partners", "/#resources", "/#terms"]) {
      expect(header).not.toContain(brokenAnchor);
      expect(footer).not.toContain(brokenAnchor);
    }
  });
});
