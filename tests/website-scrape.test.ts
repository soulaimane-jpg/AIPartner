import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { htmlToText, resolveImportSource } from "@/lib/website-scrape";
import { parsePartnerSlug } from "@/lib/partner-directory";

/**
 * SSRF is the primary threat for website import: unlike the directory path,
 * the caller controls the whole URL. These tests pin the guards.
 *
 * `fetchWebsiteText` resolves DNS, so the tests mock `node:dns/promises` to
 * assert the *decision*, not real network behaviour.
 */
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const { lookup } = await import("node:dns/promises");
const { fetchWebsiteText, WebsiteScrapeError } = await import(
  "@/lib/website-scrape"
);

function mockResolve(...addresses: string[]) {
  vi.mocked(lookup).mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    })) as never,
  );
}

describe("resolveImportSource", () => {
  it("routes a Google directory link to the RPC path", () => {
    const source = resolveImportSource(
      "https://cloud.google.com/find-a-partner/partner/devoteam",
      parsePartnerSlug,
    );
    expect(source).toEqual({
      kind: "directory",
      slug: "devoteam",
      url: "https://cloud.google.com/find-a-partner/partner/devoteam",
    });
  });

  it("routes any other host to the website scraper", () => {
    const source = resolveImportSource("https://sada.com", parsePartnerSlug);
    expect(source?.kind).toBe("website");
  });

  it("assumes https for a bare domain", () => {
    // Partners paste bare domains constantly; failing on it is user-hostile.
    const source = resolveImportSource("sada.com", parsePartnerSlug);
    expect(source).toMatchObject({ kind: "website" });
    expect((source as { url: string }).url).toBe("https://sada.com/");
  });

  it("refuses a cloud.google.com link that is not a partner page", () => {
    // Scraping Google's marketing site would extract confident nonsense.
    expect(
      resolveImportSource("https://cloud.google.com/bigquery", parsePartnerSlug),
    ).toBeNull();
  });

  it("refuses empty and unparseable input", () => {
    expect(resolveImportSource("", parsePartnerSlug)).toBeNull();
    expect(resolveImportSource("   ", parsePartnerSlug)).toBeNull();
    expect(resolveImportSource("http://", parsePartnerSlug)).toBeNull();
  });
});

describe("fetchWebsiteText SSRF guards", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockReset();
    vi.mocked(lookup).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-http schemes", async () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://example.com",
      "ftp://example.com",
    ]) {
      await expect(fetchWebsiteText(url)).rejects.toThrow(WebsiteScrapeError);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects embedded credentials", async () => {
    await expect(
      fetchWebsiteText("https://user:pass@example.com"),
    ).rejects.toThrow(/credentials/i);
  });

  it("rejects literal private and loopback addresses without DNS", async () => {
    const blocked = [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://192.168.1.1/",
      "http://172.16.5.4/",
      "http://169.254.169.254/latest/meta-data/",
      "http://0.0.0.0/",
      "http://[::1]/",
      "http://[fd00::1]/",
    ];
    for (const url of blocked) {
      await expect(fetchWebsiteText(url)).rejects.toThrow(
        /publicly reachable/i,
      );
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects localhost-style hostnames", async () => {
    for (const url of [
      "http://localhost/",
      "http://api.localhost/",
      "http://db.internal/",
    ]) {
      await expect(fetchWebsiteText(url)).rejects.toThrow(
        /publicly reachable/i,
      );
    }
  });

  it("rejects a public hostname that resolves to a private address", async () => {
    // The case hostname allow-lists miss entirely.
    mockResolve("10.0.0.5");
    await expect(fetchWebsiteText("https://internal.example.com")).rejects.toThrow(
      /publicly reachable/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a host with any private address among several", async () => {
    // One public + one private record must still fail, or the private one is
    // reachable by retry.
    mockResolve("93.184.216.34", "169.254.169.254");
    await expect(fetchWebsiteText("https://mixed.example.com")).rejects.toThrow(
      /publicly reachable/i,
    );
  });

  it("rejects an IPv4-mapped IPv6 private address", async () => {
    mockResolve("::ffff:10.0.0.1");
    await expect(fetchWebsiteText("https://mapped.example.com")).rejects.toThrow(
      /publicly reachable/i,
    );
  });

  it("re-validates redirect targets", async () => {
    // The classic escape: a public URL that 302s to the metadata service.
    mockResolve("93.184.216.34");
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );
    await expect(fetchWebsiteText("https://example.com")).rejects.toThrow(
      /publicly reachable/i,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    mockResolve("93.184.216.34");
    fetchSpy.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/next" },
      }),
    );
    await expect(fetchWebsiteText("https://example.com")).rejects.toThrow(
      /redirected too many times/i,
    );
  });

  it("rejects non-HTML content types", async () => {
    mockResolve("93.184.216.34");
    fetchSpy.mockResolvedValueOnce(
      new Response("%PDF-1.4", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    await expect(fetchWebsiteText("https://example.com")).rejects.toThrow(
      /isn't a web page/i,
    );
  });

  it("reads a public page and returns its text", async () => {
    mockResolve("93.184.216.34");
    // Deliberately realistic in length: the 400-char floor exists to catch
    // JavaScript shells, and a fixture below it would be testing the wrong
    // thing.
    const html = `
      <html><head><title>SADA</title><style>.x{color:red}</style></head>
      <body>
        <script>window.x = 1;</script>
        <h1>Cloud migration specialists</h1>
        <p>We move enterprise workloads to Google Cloud with a delivery model
           built on repeatable automation rather than bespoke consulting.</p>
        <p>Our FinOps practice has saved clients millions in cloud spend
           across retail and healthcare engagements since 2015.</p>
        <p>We hold specializations in Data Analytics, Cloud Migration and
           Infrastructure, and our team includes more than four hundred
           certified Google Cloud engineers across North America and EMEA.</p>
        <p>Typical engagements begin with a fixed-fee assessment covering
           landing zone design, identity architecture and a costed migration
           wave plan that your team owns at the end of the engagement.</p>
      </body></html>`;
    fetchSpy.mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await fetchWebsiteText("https://example.com", {
      includeSubpages: false,
    });
    expect(result.text).toContain("Cloud migration specialists");
    expect(result.text).toContain("enterprise workloads");
    // Script and style bodies must never reach the model.
    expect(result.text).not.toContain("window.x");
    expect(result.text).not.toContain("color:red");
  });

  it("rejects a page with too little readable text", async () => {
    mockResolve("93.184.216.34");
    fetchSpy.mockResolvedValue(
      new Response("<html><body><div id=root></div></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(
      fetchWebsiteText("https://example.com", { includeSubpages: false }),
    ).rejects.toThrow(/readable text/i);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles and chrome", () => {
    const text = htmlToText(
      `<nav>Home About</nav><script>evil()</script><style>a{}</style>
       <h1>Title</h1><p>Body copy.</p><footer>© 2026</footer>`,
    );
    expect(text).toContain("Title");
    expect(text).toContain("Body copy.");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("Home About");
    expect(text).not.toContain("2026");
  });

  it("turns block tags into line breaks", () => {
    const text = htmlToText("<li>One</li><li>Two</li><li>Three</li>");
    expect(text.split("\n")).toEqual(["One", "Two", "Three"]);
  });

  it("decodes common entities", () => {
    expect(htmlToText("<p>Data&nbsp;&amp;&nbsp;AI</p>")).toBe("Data & AI");
    expect(htmlToText("<p>It&#39;s here</p>")).toBe("It's here");
  });

  it("collapses runaway whitespace", () => {
    expect(htmlToText("<p>a</p>\n\n\n\n<p>b</p>")).toBe("a\nb");
  });
});
