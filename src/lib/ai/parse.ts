/**
 * Strict-parse-with-retry for LLM JSON output.
 *
 * Why this exists: the prompt is English, the contract is JSON, and
 * the model will drift. We refuse silent corruption: parse strictly,
 * retry once with a stricter system message, and log the failure if
 * both attempts fail. Callers handle the `ok: false` case explicitly.
 *
 * Generic over a Zod schema so it works for risk-radar, sourcing
 * rationale, proposal diff, etc.
 */

import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/claude";

/** Tighten the prompt for a retry — appended after a parse failure. */
const RETRY_DIRECTIVE =
  "Your previous response was not valid JSON matching the schema. " +
  "Return ONLY a single JSON object — no prose, no code fences, no preamble — " +
  "matching the schema exactly. If a field is unknown, omit it; never invent values.";

export interface ParseLlmJsonOptions<Schema extends z.ZodTypeAny> {
  /** Zod schema the response must match. */
  schema: Schema;
  /** System prompt that defines the task + JSON contract. */
  system: string;
  /** User message — typically the structured input the model reasons over. */
  user: string;
  /** Model id; defaults to the configured Claude model. */
  model?: string;
  /** Hard cap on output tokens (defensive). */
  maxTokens?: number;
  /** Sampling — keep low for structured tasks. */
  temperature?: number;
  /** Tag for the failure log so we can group by call-site. */
  tag: string;
}

export type ParseLlmJsonResult<T> =
  | { ok: true; data: T; attempts: number }
  | { ok: false; error: ParseLlmJsonError; attempts: number };

export type ParseLlmJsonError =
  | { code: "LLM_TRANSPORT"; message: string }
  | { code: "LLM_PARSE_FAIL"; raw: string; zodIssues: { path: string; message: string }[] };

function extractText(msg: Anthropic.Messages.Message): string {
  return msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Strip ```json … ``` fences and leading/trailing prose if present. */
function isolateJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw;
}

async function callOnce(
  opts: ParseLlmJsonOptions<z.ZodTypeAny>,
  extraSystem?: string,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: opts.model ?? CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    temperature: opts.temperature ?? 0.1,
    system: extraSystem ? `${opts.system}\n\n${extraSystem}` : opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return extractText(msg);
}

/**
 * Call Claude, parse the response as JSON, validate with Zod.
 * Retries once with a stricter directive on parse failure.
 */
export async function parseLlmJson<Schema extends z.ZodTypeAny>(
  opts: ParseLlmJsonOptions<Schema>,
): Promise<ParseLlmJsonResult<z.infer<Schema>>> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await callOnce(opts, attempt === 2 ? RETRY_DIRECTIVE : undefined);
    } catch (err) {
      return {
        ok: false,
        attempts: attempt,
        error: {
          code: "LLM_TRANSPORT",
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(isolateJson(raw));
    } catch {
      if (attempt === 2) {
        return {
          ok: false,
          attempts: 2,
          error: {
            code: "LLM_PARSE_FAIL",
            raw,
            zodIssues: [{ path: "$", message: "not valid JSON" }],
          },
        };
      }
      continue;
    }

    const parsed = opts.schema.safeParse(json);
    if (parsed.success) {
      return { ok: true, data: parsed.data, attempts: attempt };
    }

    if (attempt === 2) {
      return {
        ok: false,
        attempts: 2,
        error: {
          code: "LLM_PARSE_FAIL",
          raw,
          zodIssues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      };
    }
  }

  // Unreachable.
  return {
    ok: false,
    attempts: 0,
    error: { code: "LLM_TRANSPORT", message: "logic error" },
  };
}
