/**
 * Partner vetting gate — the platform's core promise is "vetted"
 * partners, so domain evidence must never over-claim and free-mail
 * signups must never look verified.
 */

import { describe, it, expect } from "vitest";
import {
  assessDomainEvidence,
  domainsMatch,
  emailDomain,
  hostFromUrl,
  isGenericEmailDomain,
} from "@/lib/partner-verification";

describe("emailDomain", () => {
  it("extracts and lower-cases the domain", () => {
    expect(emailDomain("Someone@CloudCo.com")).toBe("cloudco.com");
  });

  it("returns null for malformed addresses", () => {
    expect(emailDomain("not-an-email")).toBeNull();
    expect(emailDomain("trailing@")).toBeNull();
  });
});

describe("hostFromUrl", () => {
  it("normalises schemes and www", () => {
    expect(hostFromUrl("https://www.CloudCo.com/about")).toBe("cloudco.com");
    expect(hostFromUrl("cloudco.com")).toBe("cloudco.com");
  });

  it("returns null for empty or invalid input", () => {
    expect(hostFromUrl(null)).toBeNull();
    expect(hostFromUrl("")).toBeNull();
  });
});

describe("domainsMatch", () => {
  it("matches exact and subdomain pairs", () => {
    expect(domainsMatch("cloudco.com", "cloudco.com")).toBe(true);
    expect(domainsMatch("mail.cloudco.com", "cloudco.com")).toBe(true);
    expect(domainsMatch("cloudco.com", "careers.cloudco.com")).toBe(true);
  });

  it("never matches a free-mail domain", () => {
    expect(domainsMatch("gmail.com", "gmail.com")).toBe(false);
    expect(isGenericEmailDomain("gmail.com")).toBe(true);
  });

  it("rejects unrelated domains", () => {
    expect(domainsMatch("cloudco.com", "othercorp.com")).toBe(false);
    // Suffix collision must not count as a match.
    expect(domainsMatch("notcloudco.com", "cloudco.com")).toBe(false);
  });
});

describe("assessDomainEvidence", () => {
  it("flags a matching website", () => {
    const e = assessDomainEvidence({
      email: "amel@cloudco.com",
      website: "https://www.cloudco.com",
    });
    expect(e.matched).toBe(true);
    expect(e.reason).toBe("matches_website");
  });

  it("never trusts a free email provider", () => {
    const e = assessDomainEvidence({
      email: "amel@gmail.com",
      website: "https://cloudco.com",
    });
    expect(e.matched).toBe(false);
    expect(e.reason).toBe("generic_email_domain");
  });

  it("reports when there is nothing to compare against", () => {
    const e = assessDomainEvidence({ email: "amel@cloudco.com" });
    expect(e.matched).toBe(false);
    expect(e.reason).toBe("no_website_on_file");
  });

  it("falls back to the directory URL", () => {
    const e = assessDomainEvidence({
      email: "amel@cloudco.com",
      website: null,
      directoryUrl: "https://cloudco.com/google-partner",
    });
    expect(e.matched).toBe(true);
  });

  it("reports a mismatch rather than approving", () => {
    const e = assessDomainEvidence({
      email: "amel@othercorp.com",
      website: "https://cloudco.com",
    });
    expect(e.matched).toBe(false);
    expect(e.reason).toBe("no_match");
  });
});
