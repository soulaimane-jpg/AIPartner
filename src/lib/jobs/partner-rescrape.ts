import "server-only";

/**
 * Quarterly partner-profile re-scrape.
 *
 * Two jobs:
 *   - `partner.rescrape.sweep` — enqueues one re-scrape per eligible partner.
 *     Runs from the daily cron; the per-partner idempotency key means a
 *     partner is only ever queued once per quarter.
 *   - `partner.rescrape` — reads one partner's public sources and records
 *     field-level `ProfileChangeProposal` rows.
 *
 * **The re-scrape never writes to a profile.** It proposes; the partner
 * accepts or rejects each field. That is a deliberate constraint, for two
 * reasons:
 *
 *   1. The Google directory path depends on a private RPC and the website path
 *      on arbitrary third-party markup. Either can start returning subtly wrong
 *      values, and a silent auto-write would corrupt live profiles before
 *      anyone noticed.
 *   2. A partner's profile is their commercial positioning. Rewriting it
 *      without consent is the sort of thing that loses accounts.
 *
 * Only plain descriptive columns are ever proposed — never tags, capacity, or
 * commercials. Those are claims a human should make deliberately, and they
 * carry caps and facet rules that a diff cannot express.
 */

import { exec, genId, query, queryOne, updateRows } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import {
  fetchPartnerDirectoryText,
  parsePartnerSlug,
  PartnerDirectoryError,
} from "@/lib/partner-directory";
import {
  fetchWebsiteText,
  resolveImportSource,
  WebsiteScrapeError,
} from "@/lib/website-scrape";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";
import { fenceUntrusted, withUntrustedRule } from "@/lib/ai/untrusted";
import { LLM_TIMEOUT_MS } from "@/lib/ai/parse";

/** Re-verify roughly quarterly. */
export const RESCRAPE_INTERVAL_DAYS = 90;

/** Cap per sweep so one cron tick can't enqueue thousands of LLM calls. */
const SWEEP_BATCH = 25;

/**
 * Columns eligible for a proposal. Deliberately narrow: descriptive company
 * facts that a public page can legitimately be authoritative about.
 *
 * `applyProposal` in `actions/partner-pillars.ts` independently enforces its own
 * `SCRAPEABLE_COLUMNS` allowlist (a superset of this one) before writing, so a
 * bug here cannot widen the blast radius on its own — the action would refuse
 * to apply a field it doesn't recognise.
 */
const PROPOSABLE_FIELDS = [
  "tagline",
  "description",
  "headquarters",
  "teamSize",
  "industry",
  "gcpTier",
  "partnerSince",
] as const;

type ProposableField = (typeof PROPOSABLE_FIELDS)[number];

const RESCRAPE_PROMPT = `You are re-checking a Google Cloud partner's public profile for changes.

Return ONLY valid JSON — no prose, no code fences:

{
  "tagline": string,        // short positioning line (<= 140 chars)
  "description": string,    // 3-5 sentence narrative of what they do
  "headquarters": string,   // "City, Country"
  "teamSize": string,       // e.g. "1000-5000"
  "industry": string,       // primary sector
  "gcpTier": string,        // official tier text if shown
  "partnerSince": string    // year
}

Rules:
- Use "" for anything the page does not clearly state. An empty string means
  "not stated", and will be ignored rather than clearing existing data.
- DO NOT fabricate, infer, or extrapolate. If the page is ambiguous, use "".
- Report what the page says NOW, not what it might have said before.`;

interface RescrapeExtract {
  tagline?: string;
  description?: string;
  headquarters?: string;
  teamSize?: string;
  industry?: string;
  gcpTier?: string;
  partnerSince?: string;
}

/**
 * Queue re-scrapes for partners whose profiles are due.
 *
 * Eligibility deliberately requires `onboardingCompletedAt`: a partner still
 * mid-setup does not need us second-guessing half-entered data.
 */
export async function sweepDueRescrapes(): Promise<{
  queued: number;
  skipped: number;
}> {
  const due = await query<{
    companyId: string;
    directoryUrl: string | null;
    website: string | null;
  }>(
    `SELECT "companyId", "directoryUrl", "website"
     FROM "PartnerProfile"
     WHERE "onboardingCompletedAt" IS NOT NULL
       AND ("directoryUrl" IS NOT NULL OR "website" IS NOT NULL)
       AND ("lastScrapedAt" IS NULL
            OR "lastScrapedAt" < NOW() - ($1 || ' days')::interval)
     ORDER BY "lastScrapedAt" ASC NULLS FIRST
     LIMIT $2`,
    [String(RESCRAPE_INTERVAL_DAYS), SWEEP_BATCH],
  );

  let queued = 0;
  let skipped = 0;

  for (const row of due) {
    // Quarter-bucketed key: re-running the sweep inside the same quarter is a
    // no-op, so a cron misfire or manual trigger cannot double-charge us for
    // LLM calls.
    const now = new Date();
    const bucket = `${now.getUTCFullYear()}Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
    const { deduped } = await enqueue(
      "partner.rescrape",
      { companyId: row.companyId },
      { idemKey: `rescrape:${row.companyId}:${bucket}`, maxAttempts: 3 },
    );
    if (deduped) skipped++;
    else queued++;
  }

  return { queued, skipped };
}

/** Read whichever public sources a partner has, tolerating per-source failure. */
async function readSources(
  directoryUrl: string | null,
  website: string | null,
): Promise<{ source: "directory" | "website"; url: string; text: string }[]> {
  const out: { source: "directory" | "website"; url: string; text: string }[] =
    [];

  if (directoryUrl) {
    const slug = parsePartnerSlug(directoryUrl);
    if (slug) {
      try {
        out.push({
          source: "directory",
          url: directoryUrl,
          text: await fetchPartnerDirectoryText(slug),
        });
      } catch (err) {
        // A directory failure must not block the website read. Both being
        // unavailable is handled by the caller seeing an empty array.
        if (
          !(err instanceof PartnerDirectoryError) &&
          !(err instanceof WebsiteScrapeError)
        ) {
          throw err;
        }
      }
    }
  }

  if (website) {
    const resolved = resolveImportSource(website, parsePartnerSlug);
    if (resolved?.kind === "website") {
      try {
        const scraped = await fetchWebsiteText(resolved.url);
        out.push({
          source: "website",
          url: scraped.finalUrl,
          text: scraped.text,
        });
      } catch (err) {
        if (
          !(err instanceof PartnerDirectoryError) &&
          !(err instanceof WebsiteScrapeError)
        ) {
          throw err;
        }
      }
    }
  }

  return out;
}

async function extract(text: string, url: string): Promise<RescrapeExtract> {
  // The partner controls this text completely, and the extraction feeds
  // profile fields that feed matching. Fence it and tell the model the
  // markers delimit data, not instructions.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let msg;
  try {
    msg = await anthropic.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: withUntrustedRule(RESCRAPE_PROMPT),
        messages: [
          {
            role: "user",
            content: `Source URL: ${url}\n\n${fenceUntrusted(text, {
              source: "partner website",
            })}`,
          },
        ],
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timer);
  }
  const raw = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(raw) as RescrapeExtract;
  } catch {
    throw new Error("rescrape extraction returned invalid JSON");
  }
}

/**
 * Is this difference worth asking a human about?
 *
 * The bar is deliberately high. A proposal costs the partner attention, and a
 * feed of trivial whitespace and punctuation diffs would train them to dismiss
 * everything — including the one change that mattered.
 */
function isMeaningfulChange(
  current: string | null,
  proposed: string,
): boolean {
  const p = proposed.trim();
  if (!p) return false; // "" means "not stated", never "clear this field"

  const c = (current ?? "").trim();
  if (!c) return true; // filling a gap is always worth offering

  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim();
  if (norm(c) === norm(p)) return false;

  // For long prose, ignore edits that barely move the text. Marketing copy gets
  // reworded constantly without changing meaning.
  if (c.length > 120) {
    const shorter = Math.min(c.length, p.length);
    const longer = Math.max(c.length, p.length);
    if (shorter / longer > 0.92) return false;
  }

  return true;
}

/**
 * Re-scrape one partner and record proposals.
 *
 * Always stamps `lastScrapedAt`, even when nothing changed — otherwise a
 * partner whose page never changes would be re-scraped on every sweep forever.
 */
export async function rescrapePartner(companyId: string): Promise<{
  proposed: number;
  sourcesRead: number;
}> {
  const profile = await queryOne<{
    companyId: string;
    directoryUrl: string | null;
    website: string | null;
    tagline: string | null;
    description: string | null;
    headquarters: string | null;
    teamSize: string | null;
    industry: string | null;
    gcpTier: string | null;
    partnerSince: string | null;
  }>(
    `SELECT "companyId","directoryUrl","website","tagline","description",
            "headquarters","teamSize","industry","gcpTier","partnerSince"
     FROM "PartnerProfile" WHERE "companyId" = $1`,
    [companyId],
  );
  if (!profile) return { proposed: 0, sourcesRead: 0 };

  const sources = await readSources(profile.directoryUrl, profile.website);

  // Stamp before returning so an unreachable partner isn't retried every day.
  await updateRows(
    "PartnerProfile",
    { companyId },
    { lastScrapedAt: new Date() },
  );
  if (sources.length === 0) return { proposed: 0, sourcesRead: 0 };

  // Supersede prior unresolved proposals: showing a partner two competing
  // suggestions for the same field from different quarters is confusing, and
  // the newer read is always the more accurate one.
  await exec(
    `UPDATE "ProfileChangeProposal"
     SET "status" = 'superseded', "updatedAt" = NOW()
     WHERE "companyId" = $1 AND "status" = 'pending'`,
    [companyId],
  );

  let proposed = 0;

  for (const src of sources) {
    let data: RescrapeExtract;
    try {
      data = await extract(src.text, src.url);
    } catch {
      continue; // one bad extraction shouldn't sink the other source
    }

    for (const field of PROPOSABLE_FIELDS) {
      const proposedValue = String(data[field] ?? "");
      const currentValue = profile[field as ProposableField] ?? null;
      if (!isMeaningfulChange(currentValue, proposedValue)) continue;

      // The directory is authoritative for tier, so a website read must not
      // overwrite a directory-sourced proposal for the same field.
      const already = await queryOne<{ id: string }>(
        `SELECT "id" FROM "ProfileChangeProposal"
         WHERE "companyId" = $1 AND "fieldKey" = $2 AND "status" = 'pending'`,
        [companyId, field],
      );
      if (already) continue;

      await exec(
        `INSERT INTO "ProfileChangeProposal"
           ("id","companyId","source","sourceUrl","fieldKey",
            "currentValue","proposedValue","status","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',NOW(),NOW())`,
        [
          genId(),
          companyId,
          src.source,
          src.url,
          field,
          currentValue,
          proposedValue.trim(),
        ],
      );
      proposed++;
    }
  }

  return { proposed, sourcesRead: sources.length };
}
