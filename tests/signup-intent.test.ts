import { describe, it, expect } from "vitest";
import { brandLabelFromEmail, companyNameFromEmail } from "@/lib/signup-intent";

describe("companyNameFromEmail", () => {
  it("derives a brand from a corporate domain", () => {
    expect(companyNameFromEmail("sam@devoteam.com")).toBe("Devoteam");
    expect(companyNameFromEmail("a.b@accenture.net")).toBe("Accenture");
  });

  it("handles country-code second-level suffixes", () => {
    // Naive TLD stripping would yield "Co" here.
    expect(companyNameFromEmail("ops@acme.co.uk")).toBe("Acme");
    expect(companyNameFromEmail("ops@acme.com.au")).toBe("Acme");
  });

  it("uses the registrable label, not the subdomain", () => {
    expect(companyNameFromEmail("sam@mail.devoteam.com")).toBe("Devoteam");
    expect(companyNameFromEmail("sam@eu.west.contoso.com")).toBe("Contoso");
  });

  it("title-cases hyphenated brands", () => {
    expect(companyNameFromEmail("x@cloud-first.com")).toBe("Cloud First");
  });

  it("keeps known acronyms upper-case", () => {
    expect(companyNameFromEmail("x@ibm.com")).toBe("IBM");
    expect(companyNameFromEmail("x@sap.com")).toBe("SAP");
  });

  it("is case and whitespace insensitive", () => {
    expect(companyNameFromEmail("Sam@DEVOTEAM.com")).toBe("Devoteam");
    expect(companyNameFromEmail("sam@ devoteam.com ")).toBe("Devoteam");
  });

  it("strips a www. prefix", () => {
    expect(companyNameFromEmail("sam@www.devoteam.com")).toBe("Devoteam");
  });
});

describe("consumer mailboxes are rejected", () => {
  // The whole point of the guard: these must not become companies named
  // "Gmail" or "Outlook".
  const consumer = [
    "a@gmail.com",
    "a@googlemail.com",
    "a@outlook.com",
    "a@hotmail.fr",
    "a@yahoo.co.uk",
    "a@icloud.com",
    "a@proton.me",
    "a@protonmail.com",
    "a@qq.com",
    "a@gmx.de",
    "a@yandex.ru",
    "a@aol.com",
    "a@live.nl",
  ];

  for (const email of consumer) {
    it(`returns null for ${email}`, () => {
      expect(companyNameFromEmail(email)).toBeNull();
      expect(brandLabelFromEmail(email)).toBeNull();
    });
  }
});

describe("malformed input", () => {
  for (const bad of ["", "no-at-sign", "a@", "a@localhost", "@example.com", "a@b@c.com"]) {
    it(`returns null for ${JSON.stringify(bad)}`, () => {
      expect(companyNameFromEmail(bad)).toBeNull();
    });
  }

  it("rejects a domain with no dot", () => {
    expect(companyNameFromEmail("a@intranet")).toBeNull();
  });

  it("rejects an address with more than one @", () => {
    // Declining beats guessing: picking a side here would invent a company
    // from input that is not a valid address.
    expect(companyNameFromEmail("weird@name@devoteam.com")).toBeNull();
  });
});
