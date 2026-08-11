/**
 * Guards a Next.js rule that only fails at runtime, and then fails loudly:
 * a `"use server"` module may export nothing but async functions.
 *
 * Exporting any value — an object, an array, a re-exported const — makes the
 * server-actions loader for *every page that imports the module* throw
 *   `A "use server" file can only export async functions, found object.`
 * The page then renders the error boundary instead of the UI. That is how the
 * partner onboarding wizard came to crash on step 3: `partner-pillars.ts`
 * re-exported the `PILLARS` object as `PILLAR_META`.
 *
 * Type-only exports are erased before the loader ever sees them, so they are
 * fine and deliberately allowed here.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Exports that are legal in a server-action module. */
const ALLOWED = [
  /^export\s+async\s+function\s/, // export async function foo()
  /^export\s+type\s/, // erased at compile time
  /^export\s+interface\s/, // erased at compile time
  /^export\s+const\s+\w+\s*=\s*defineAction\(/, // returns an async function
  /^export\s+const\s+\w+\s*=\s*async\s*\(/, // async arrow
  /^export\s+const\s+\w+\s*=\s*async\s+function\b/,
  // Same-file alias block, e.g. `export { fooAction as foo };`. The aliased
  // bindings are declared in this file and checked at their definition site.
  // `export … from "…"` stays flagged: it re-exports another module's
  // bindings, which this scan cannot see into.
  /^export\s*\{(?![^}]*\bfrom\b)/,
];

describe('"use server" modules', () => {
  const serverFiles = walk(SRC).filter((f) => {
    const head = readFileSync(f, "utf8").slice(0, 200);
    return /^["']use server["'];/m.test(head);
  });

  it("finds the server-action modules to check", () => {
    expect(serverFiles.length).toBeGreaterThan(20);
  });

  it("export only async functions", () => {
    const offenders: string[] = [];

    for (const file of serverFiles) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/^export\b/.test(line)) return;
        if (ALLOWED.some((re) => re.test(line))) return;
        offenders.push(
          `${file.replace(process.cwd() + "/", "")}:${i + 1}  ${line.trim()}`,
        );
      });
    }

    expect(
      offenders,
      `A "use server" file may only export async functions. Move these values ` +
        `into a module without the "use server" directive:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
