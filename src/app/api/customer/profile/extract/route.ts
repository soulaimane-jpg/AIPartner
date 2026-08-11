import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { insertRow } from "@/lib/db";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { anonymize, type CustomerRawProfile } from "@/lib/customer-profile";
import { assertSafePublicUrl, UnsafeUrlError } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTRACTION_PROMPT = `You extract a structured professional profile from a LinkedIn page or company website HTML.

Return ONLY valid JSON matching EXACTLY this schema. No prose. No markdown code fences.

{
  "fullName": string,                   // person's name if on the page, else ""
  "role": string,                        // current job title
  "seniority": string,                   // one of: "IC", "Manager", "Director", "VP", "C-Level"
  "headline": string,                    // one-liner headline / tagline
  "summary": string,                     // 2-4 sentence about / bio
  "company": {
    "name": string,
    "industry": string,
    "size": string,                      // "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+"
    "website": string,
    "hq": string,
    "region": string                     // "North America" | "EMEA" | "APAC" | "LATAM" | ""
  },
  "expertise": string[],                 // tech stack + domain tags (10-20 items)
  "pastProjects": string[],              // short descriptions of initiatives visible on the page
  "careerHighlights": string[],          // notable achievements / recognitions
  "goals": string[],                     // stated strategic goals / what they're focused on now
  "contactHints": {
    "email": string,                     // only if clearly shown on the page
    "phone": string,
    "linkedin": string
  }
}

Rules:
- If a field isn't derivable, return "" for strings, [] for arrays, or an empty object.
- DO NOT fabricate. Only extract what's on the page.
- For "region", map from HQ country: USA/Canada → "North America"; Europe → "EMEA"; Asia-Pacific → "APAC"; Latin America → "LATAM".
- Output a SINGLE JSON object. No wrapping, no commentary.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user?.companyId ||
    (session.user.role !== "CUSTOMER" && session.user.role !== "ADMIN")
  ) {
    return Response.json({ error: "Customer only" }, { status: 401 });
  }

  const { linkedinUrl, websiteUrl } = (await req.json()) as {
    linkedinUrl?: string;
    websiteUrl?: string;
  };

  const url = (linkedinUrl || websiteUrl || "").trim();
  if (!url) {
    return Response.json({ error: "Paste a valid URL" }, { status: 400 });
  }

  // This fetch is driven entirely by user input, so it has to be screened
  // against internal addresses before it leaves the container.
  try {
    await assertSafePublicUrl(url);
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // Fetch the page
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return Response.json(
        { error: `Could not fetch page (HTTP ${res.status})` },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch {
    return Response.json({ error: "Could not reach that URL" }, { status: 502 });
  }

  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80_000);

  try {
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Source URL: ${url}\n\nHTML:\n${clean}`,
        },
      ],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const raw = JSON.parse(cleaned) as CustomerRawProfile;

    const anonymized = anonymize(raw);

    await insertRow(
      "CustomerProfile",
      {
        companyId: session.user.companyId,
        linkedinUrl: linkedinUrl || null,
        websiteUrl: websiteUrl || null,
        rawProfile: JSON.stringify(raw),
        anonymizedProfile: JSON.stringify(anonymized),
        lastExtractedAt: new Date(),
      },
      {
        onConflict: `("companyId") DO UPDATE SET
          "linkedinUrl" = EXCLUDED."linkedinUrl",
          "websiteUrl" = EXCLUDED."websiteUrl",
          "rawProfile" = EXCLUDED."rawProfile",
          "anonymizedProfile" = EXCLUDED."anonymizedProfile",
          "lastExtractedAt" = EXCLUDED."lastExtractedAt",
          "updatedAt" = EXCLUDED."updatedAt"`,
      },
    );

    return Response.json({ ok: true, raw, anonymized });
  } catch (e) {
    console.error(
      "Customer profile extract failed:",
      e instanceof Error ? e.message : e,
    );
    return Response.json(
      { error: "Could not extract profile — try the other URL or fill manually." },
      { status: 500 },
    );
  }
}
